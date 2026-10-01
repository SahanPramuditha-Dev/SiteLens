import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';
import type { ScriptAnalysis } from '@sitelens/shared-types';
type Node = any;
const member = (n: Node): string =>
  !n
    ? ''
    : n.type === 'Identifier'
      ? n.name
      : n.type === 'MemberExpression'
        ? `${member(n.object)}.${n.computed && n.property.type === 'Literal' ? n.property.value : n.property.name}`
        : '';
const sourceName = (n: Node) => {
  const m = member(n).replace(/^window\./, '');
  return /^(location\.(href|search|hash|pathname)|document\.(URL|referrer|cookie))$/.test(m)
    ? m
    : member(n) === 'window.name'
      ? 'window.name'
      : '';
};
export function analyzeScripts(scripts: { id: string; code: string }[]): ScriptAnalysis {
  const out: ScriptAnalysis = {
    apis: [],
    sources: [],
    flows: [],
    handlers: [],
    parsed: 0,
    failed: 0,
    limitation:
      'Static AST analysis of collected inline scripts only. Direct expressions and simple local aliases are traced; sanitization, runtime paths, interprocedural flows and exploitability are not established. External scripts are not fetched.',
  };
  for (const script of scripts.slice(0, 100)) {
    if (script.code.length > 500000) {
      out.failed++;
      continue;
    }
    let tree: Node;
    try {
      tree = parse(script.code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowReturnOutsideFunction: true,
      });
      out.parsed++;
    } catch {
      out.failed++;
      continue;
    }
    const taint = new Map<string, Set<string>>(),
      scriptVariables = new Set<string>();
    const scope = (ancestors: Node[]) =>
      ancestors.filter((a) => /Function/.test(a.type)).at(-1)?.start ?? 0;
    const messageParameters = new Map<number, string>();
    fullAncestor(tree, (n: Node) => {
      const handler =
        n.type === 'CallExpression' &&
        member(n.callee).endsWith('addEventListener') &&
        n.arguments[0]?.value === 'message'
          ? n.arguments[1]
          : n.type === 'AssignmentExpression' && /^(window\.)?onmessage$/.test(member(n.left))
            ? n.right
            : undefined;
      if (handler?.params?.[0]?.type === 'Identifier')
        messageParameters.set(handler.start, handler.params[0].name);
    });
    const observedSource = (node: Node, s: number) =>
      sourceName(node) ||
      (messageParameters.has(s) && member(node) === `${messageParameters.get(s)}.data`
        ? 'postMessage event.data'
        : '');
    const trace = (node: Node, s: number, depth = 0): Set<string> => {
      if (!node || depth > 15) return new Set();
      const direct = observedSource(node, s);
      if (direct) return new Set([direct]);
      if (node.type === 'Identifier') return taint.get(`${s}:${node.name}`) || new Set();
      if (
        node.type === 'CallExpression' &&
        /^(localStorage|sessionStorage)\.getItem$/.test(member(node.callee))
      )
        return new Set([member(node.callee)]);
      if (
        node.type === 'CallExpression' &&
        /DOMPurify\.sanitize|trustedTypes\.createPolicy/.test(member(node.callee))
      )
        return new Set();
      const result = new Set<string>();
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end'].includes(key)) continue;
        for (const child of Array.isArray(value) ? value : [value])
          if (child && typeof child === 'object' && 'type' in child)
            for (const src of trace(child, s, depth + 1)) result.add(src);
      }
      return result;
    };
    fullAncestor(tree, (node: Node, _state: unknown, ancestors: Node[]) => {
      const s = scope(ancestors),
        line = node.loc?.start.line || 1;
      const src = observedSource(node, s);
      if (
        src &&
        !out.sources.some((x) => x.name === src && x.scriptId === script.id && x.line === line)
      )
        out.sources.push({ name: src, scriptId: script.id, line });
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
        taint.set(`${s}:${node.id.name}`, trace(node.init, s));
        if (
          node.init?.type === 'CallExpression' &&
          member(node.init.callee) === 'document.createElement' &&
          node.init.arguments[0]?.value === 'script'
        )
          scriptVariables.add(`${s}:${node.id.name}`);
      }
      if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier')
        taint.set(`${s}:${node.left.name}`, trace(node.right, s));
      let sink = '',
        argument: Node;
      if (node.type === 'AssignmentExpression') {
        const name = member(node.left);
        if (/\.(innerHTML|outerHTML)$/.test(name)) sink = name.split('.').at(-1)!;
        else if (/(^|\.)location(\.(href|search|hash))?$/.test(name)) sink = 'location assignment';
        else if (
          node.left.type === 'MemberExpression' &&
          node.left.property.name === 'src' &&
          scriptVariables.has(`${s}:${member(node.left.object)}`)
        )
          sink = 'script.src';
        argument = node.right;
      }
      if (node.type === 'CallExpression' || node.type === 'NewExpression') {
        const name = member(node.callee);
        if (
          ['eval', 'Function', 'document.write', 'document.writeln'].includes(name) ||
          /\.insertAdjacentHTML$/.test(name) ||
          /^(?:window\.)?location\.(assign|replace)$/.test(name)
        )
          sink = name;
        else if (
          ['setTimeout', 'setInterval', 'window.setTimeout', 'window.setInterval'].includes(name) &&
          ['Literal', 'TemplateLiteral', 'BinaryExpression'].includes(node.arguments[0]?.type) &&
          typeof node.arguments[0]?.value !== 'number'
        )
          sink = `${name}(string)`;
        argument = /insertAdjacentHTML$/.test(name) ? node.arguments[1] : node.arguments[0];
        if (name.endsWith('addEventListener') && node.arguments[0]?.value === 'message') {
          const handler = node.arguments[1],
            param = handler?.params?.[0]?.name;
          if (handler && param) {
            let originCheck = false,
              sourceCheck = false;
            fullAncestor(handler, (n: Node) => {
              if (
                n.type === 'BinaryExpression' &&
                ['===', '==', '!==', '!='].includes(n.operator)
              ) {
                const names = [member(n.left), member(n.right)];
                originCheck ||= names.includes(`${param}.origin`);
                sourceCheck ||= names.includes(`${param}.source`);
              }
            });
            out.handlers.push({
              scriptId: script.id,
              line,
              originCheck,
              sourceCheck,
              validation: originCheck || sourceCheck ? 'pattern observed' : 'not resolved',
            });
          } else
            out.handlers.push({
              scriptId: script.id,
              line,
              originCheck: false,
              sourceCheck: false,
              validation: 'not resolved',
            });
        }
      }
      if (sink) {
        out.apis.push({ name: sink, scriptId: script.id, line });
        for (const source of trace(argument, s))
          out.flows.push({
            source,
            sink,
            scriptId: script.id,
            line,
            confidence: 'medium',
            method: 'Direct expression or simple lexical alias',
          });
      }
    });
  }
  out.apis = out.apis.slice(0, 300);
  out.sources = out.sources.slice(0, 300);
  out.flows = out.flows.slice(0, 150);
  out.handlers = out.handlers.slice(0, 100);
  return out;
}

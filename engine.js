export const redactUrl=value=>{try{const u=new URL(value);u.username='';u.password='';if(u.search)u.search='?REDACTED';u.hash='';return u.href;}catch{return '[unavailable URL]';}};
export const redactHeader=value=>value.replace(/'nonce-[^']*'/gi,"'nonce-[REDACTED]'").replace(/https?:\/\/[^\s;]+/g,redactUrl);
export function assess(page,response,now=new Date().toISOString()) {
  const result={id:crypto.randomUUID(),version:'0.1.0',url:redactUrl(page.url),createdAt:now,findings:[],evidence:[],resources:[],technologies:page.indicators||[],coverage:[],checksCompleted:0,checksTotal:10};
  const add=(checkId,title,status,severity,observation,impact,recommendation,type,value,confidence='high')=>{
    const evidence={id:`EV-${result.evidence.length+1}`,type,source:result.url,observedValue:value,redacted:true,collectedAt:response&&type==='header'?response.collectedAt:now};result.evidence.push(evidence);
    result.findings.push({id:`${checkId}-${result.findings.length}`,checkId,title,status,severity,confidence,affectedUrl:result.url,observation,impact,recommendation,validation:'Inspect the selected page again after reloading it and compare the new evidence.',evidenceIds:[evidence.id],lifecycle:'new',createdAt:now});
    if(status!=='unable_to_assess')result.checksCompleted++;
  };
  add('SL-TLS-001','Document transport',page.url.startsWith('https:')?'protection_observed':'potential_weakness',page.url.startsWith('https:')?'informational':'high',page.url.startsWith('https:')?'The document uses HTTPS.':'The document uses HTTP.','HTTPS protects transport; it does not establish application security.','Use HTTPS for all pages.','document',result.url);
  const definitions=[
    ['SL-CSP-001','Content Security Policy','content-security-policy','A CSP can reduce the impact of some content injection attacks; absence does not prove XSS.','Introduce and test a restrictive CSP, starting with Report-Only.'],
    ['SL-HEADER-001','HTTP Strict Transport Security','strict-transport-security','HSTS can instruct browsers to use HTTPS on future visits.','On an HTTPS site, review an HSTS policy and deployment scope.'],
    ['SL-HEADER-002','Content type protection','x-content-type-options','nosniff reduces MIME type guessing.','Return X-Content-Type-Options: nosniff.'],
    ['SL-HEADER-003','Referrer Policy','referrer-policy','A referrer policy controls URL information shared with other origins.','Review and set an appropriate Referrer-Policy.'],
    ['SL-HEADER-004','Framing protection','x-frame-options','Framing restrictions can reduce clickjacking exposure.','Use CSP frame-ancestors or an appropriate X-Frame-Options policy.']
  ];
  for(const [id,title,key,impact,rec] of definitions){
    const meta=key==='content-security-policy'&&page.metaCsp?.length;
    const framing=key==='x-frame-options'&&response?.headers['content-security-policy']?.match(/(?:^|;)\s*frame-ancestors\s+[^;]+/i);
    const value=response?.headers[key];
    const present=!!value||!!meta||!!framing;
    const effective=key==='x-content-type-options'?value?.trim().toLowerCase()==='nosniff':key==='strict-transport-security'?page.url.startsWith('https:')&&/max-age\s*=\s*[1-9]\d*/i.test(value||''):key==='x-frame-options'?!!framing||/^(deny|sameorigin)$/i.test(value?.trim()||''):present;
    const known=!!response||!!meta;
    add(id,title,known?(effective?'protection_observed':'potential_weakness'):'unable_to_assess',known&&!effective?'medium':'informational',known?(present?'Policy observed; effectiveness requires contextual review.':'Policy not observed in the captured document response.'):'Document response headers were not captured. Reload the target after granting site access, then inspect again.',impact,rec,meta?'html':'header',meta?'CSP meta element observed; policy text omitted for privacy.':value?`${key}: ${redactHeader(value)}`:framing?'CSP frame-ancestors directive observed.':known?`${key}: <not present>`:'<unavailable>');
  }
  result.resources=(page.resources||[]).map(r=>({...r,url:redactUrl(r.url),thirdParty:new URL(r.url,page.url).origin!==new URL(page.url).origin}));
  const mixed=result.resources.filter(r=>page.url.startsWith('https:')&&r.url.startsWith('http:'));
  add('SL-RESOURCE-001','Mixed content references',mixed.length?'potential_weakness':'protection_observed',mixed.length?'medium':'informational',`${mixed.length} HTTP resource references observed on this document.`,'DOM references do not prove a resource was loaded; browser blocking and runtime requests are not assessed.','Replace insecure resource URLs with HTTPS.','resource',JSON.stringify(mixed));
  const sri=result.resources.filter(r=>r.thirdParty&&['script','link'].includes(r.type)&&!r.integrity);
  add('SL-RESOURCE-002','Third-party resource integrity',sri.length?'potential_weakness':'not_applicable','low',`${sri.length} third-party script or stylesheet references lack an integrity attribute.`,'SRI applicability depends on resource stability and CORS support. Missing SRI is not a confirmed vulnerability.','Review SRI applicability for static third-party scripts and stylesheets.','resource',JSON.stringify(sri));
  const insecure=(page.forms||[]).filter(f=>f.password&&new URL(f.action,page.url).protocol==='http:');
  add('SL-FORM-001','Password form destinations',insecure.length?'potential_weakness':'protection_observed',insecure.length?'high':'informational',`${insecure.length} password forms declare an HTTP destination.`,'JavaScript may alter submissions. Authentication and authorization are not tested.','Use HTTPS for password form actions.','html',JSON.stringify(insecure.map(f=>({...f,action:redactUrl(f.action)}))));
  add('SL-COOKIE-001','Cookie attributes','unable_to_assess','informational','Cookie attributes are not collected in this release.','Document JavaScript cannot assess HttpOnly cookies.','Review cookie attributes in browser developer tools.','cookie','<not collected>');
  result.coverage=[['Document HTTPS','assessed'],['Security headers',response?'assessed':'partial'],['Page resource references','assessed'],['HTML form destinations','assessed'],['Client libraries','partial'],['Cookie attributes','not assessed'],['Authentication / authorization','not assessed'],['Database / business logic','not assessable'],['TLS certificates / protocol configuration','not assessed'],['Redirect chain / runtime requests','not assessed']].map(([area,status])=>({area,status}));
  return result;
}

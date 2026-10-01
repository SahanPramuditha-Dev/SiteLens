export function collectPage() {
  const resources=[...document.querySelectorAll('script[src],link[rel="stylesheet"][href],img[src],iframe[src]')].map(el=>({url:el.src||el.href,type:el.tagName.toLowerCase(),integrity:el.getAttribute('integrity'),crossorigin:el.getAttribute('crossorigin')}));
  const forms=[...document.forms].map(form=>({action:form.action,method:form.method,password:!!form.querySelector('input[type="password"]')}));
  const indicators=[];
  if(document.querySelector('[data-reactroot]') || [...document.querySelectorAll('*')].slice(0,3000).some(el=>Object.keys(el).some(key=>key.startsWith('__reactFiber$')))) indicators.push({name:'React',confidence:'high',observation:'React-specific DOM runtime markers observed.'});
  if(document.querySelector('[ng-version]')) indicators.push({name:'Angular',confidence:'high',observation:'Angular ng-version DOM attribute observed; version not retained.'});
  if(document.querySelector('[data-v-app]')) indicators.push({name:'Vue',confidence:'medium',observation:'data-v-app DOM marker observed.'});
  for(const [name,pattern] of [['Google Analytics',/google-analytics\.com|googletagmanager\.com/],['Bootstrap',/bootstrap(?:\.min)?\.(?:js|css)/],['jQuery',/jquery(?:[.-][\d.]+)?(?:\.min)?\.js/]]) if(resources.some(r=>pattern.test(r.url))) indicators.push({name,confidence:'medium',observation:'Matching resource URL indicator observed; resource contents not inspected.'});
  return {url:location.href,title:document.title,resources,forms,indicators,metaCsp:[...document.querySelectorAll('meta[http-equiv]')].filter(el=>el.httpEquiv.toLowerCase()==='content-security-policy').map(el=>el.content),storage:{local:'Not collected',session:'Not collected'}};
}

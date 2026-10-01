import {collectPage} from './collector.js';
import {assess,redactHeader} from './engine.js';
const observations=new Map();
chrome.webRequest.onHeadersReceived.addListener(details=>{
  if(details.type!=='main_frame'||details.tabId<0)return;
  // Retain only security-relevant headers, never Set-Cookie, authorization, or arbitrary values.
  const allowed=new Set(['content-security-policy','content-security-policy-report-only','strict-transport-security','x-content-type-options','referrer-policy','x-frame-options','permissions-policy','server','x-powered-by']);
  const headers=Object.fromEntries((details.responseHeaders||[]).filter(h=>allowed.has(h.name.toLowerCase())).map(h=>[h.name.toLowerCase(),redactHeader(h.value||'')]));
  const record={url:details.url,statusCode:details.statusCode,headers,collectedAt:new Date().toISOString()};
  observations.set(details.tabId,record);
  chrome.storage.session.set({['response_'+details.tabId]:record});
},{urls:['http://*/*','https://*/*']},['responseHeaders']);
chrome.tabs.onRemoved.addListener(id=>{observations.delete(id);chrome.storage.session.remove('response_'+id);});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.type!=='inspect')return;
  (async()=>{
    const start=performance.now();
    const tab=await chrome.tabs.get(message.tabId);
    if(!/^https?:\/\//.test(tab.url||''))throw new Error('Only HTTP and HTTPS pages can be inspected.');
    const [{result:page}]=await chrome.scripting.executeScript({target:{tabId:message.tabId},func:collectPage});
    const cached=observations.get(message.tabId)||(await chrome.storage.session.get('response_'+message.tabId))['response_'+message.tabId];
    const normalize=url=>{const u=new URL(url);u.hash='';return u.href;};
    const response=cached && normalize(cached.url)===normalize(page.url)?cached:null;
    const assessment=assess(page,response);
    assessment.durationMs=Math.round(performance.now()-start);assessment.tabId=message.tabId;
    const {assessments=[]}=await chrome.storage.local.get('assessments');
    await chrome.storage.local.set({assessments:[assessment,...assessments].slice(0,50)});
    return {id:assessment.id};
  })().then(reply).catch(error=>reply({error:error.message}));
  return true;
});

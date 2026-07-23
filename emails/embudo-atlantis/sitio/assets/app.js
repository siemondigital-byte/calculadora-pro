(function(){
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  var lang=store.get('agr-lang')||((navigator.language||'es').slice(0,2)==='en'?'en':'es');
  function applyLang(){document.documentElement.lang=lang;
    document.querySelectorAll('.lang-seg button').forEach(function(b){b.classList.toggle('on',b.dataset.lang===lang)});
    var dict=(window.I18N&&window.I18N[lang])||{};
    document.querySelectorAll('[data-i18n]').forEach(function(el){var v=dict[el.dataset.i18n];if(v!=null)el.textContent=v});
    document.querySelectorAll('[data-i18n-html]').forEach(function(el){var v=dict[el.dataset.i18nHtml];if(v!=null)el.innerHTML=v});
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el){var v=dict[el.dataset.i18nPh];if(v!=null)el.placeholder=v});
    document.querySelectorAll('a[data-href-es]').forEach(function(a){a.setAttribute('href',lang==='en'?a.dataset.hrefEn:a.dataset.hrefEs)});
    document.dispatchEvent(new CustomEvent('langchange',{detail:lang}));}
  window.AGR={t:function(k){var d=(window.I18N&&window.I18N[lang])||{};return d[k]||k},get lang(){return lang}};
  document.addEventListener('DOMContentLoaded',function(){
    applyLang();
    document.querySelectorAll('.lang-seg button').forEach(function(b){
      b.addEventListener('click',function(){lang=b.dataset.lang;store.set('agr-lang',lang);applyLang();});});
  });
})();

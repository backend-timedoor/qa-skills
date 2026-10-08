# launch-checks

Source of truth for the launch-check plugins. Edit here, then run ./sync.sh; never edit plugins/*/vendor/ by hand.

Check that the plugin copies match this folder with: ./sync.sh --check

## Evidence shape

```
evidence = {
  baseUrl, capturedAt,
  pages: [{ url, status, error?, isHome, title, metas:[{name,property,content}],
            headings:[{level,text}], images:[{src,alt,loading,bytes,width,height,naturalWidth,naturalHeight,inViewport}],
            links:[{href,text}], footer:{text,creditLink:{href,target,color}|null,textColor}|null,
            bodyText, scripts:{captcha,ga}, favicon, breadcrumb, mapEmbeds, forms:[{fields:[{type,name,required}]}] }],
  site:  { expectedHost, robots:{status,body}, redirects:{http:{finalUrl,error?}, wwwHttp:{finalUrl,error?}},
           notFound:{status}, brokenLinks:[{url,status,from:[pageUrl]}], scripts:{captcha,ga},
           basicAuth:{challenged}, pagespeed:{mobile,desktop,error} }
}
```

## Check function contract

A check function is `(evidence, ctx) => { status, reason?, pages? }`, where `ctx = { expectations, thresholds, language, figmaUrl }`. The engine adds `id`, `group`, `check`, `type`, `steps`, `expected`.

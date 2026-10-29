// Form embed code as providers hand it out, for Checkout Form tests (docs/DECISIONS.md D-048).

/** The owner's Storelink order form, verbatim. Tests route these hosts to stubs; never fetched. */
export const STORELINK_SNIPPET =
  '<script id="evf-widget-script">!function(e,m,t,r,o,d,a){(d=m.createElement(t)).async=!0,d.src=r,(a=m.getElementsByTagName(t)[0]).parentNode.insertBefore(d,a),d.onload=()=>o(e)}(window,document,"script","https://srstorebdg.storelink.id/script/embed",e=>{e.embedEvfScript({url:"https://srstorebdg.storelink.id/teh-kumis-kucing",delayLoad:200})});</script>';

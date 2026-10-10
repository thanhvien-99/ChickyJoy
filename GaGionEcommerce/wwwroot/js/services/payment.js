import { sitePayment } from '../data/catalog.js';
import { qrcodegen } from '../vendor/qrcodegen.js';

// QR được cung cấp bởi chủ cửa hàng, đã đọc và đối chiếu với ảnh gốc.
// Mã nhận tiền cố định: số tiền và nội dung từng đơn cần nhập trong app ngân hàng.
export const paymentConfig = sitePayment;
export function qrImage(payload){
 const code=qrcodegen.QrCode.encodeText(payload,qrcodegen.QrCode.Ecc.MEDIUM);
 let cells='';for(let y=0;y<code.size;y++)for(let x=0;x<code.size;x++)if(code.getModule(x,y))cells+=`M${x+4},${y+4}h1v1h-1z`;
 const side=code.size+8;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="400" height="400" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${cells}" fill="black"/></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

export function createPaymentQr(order){
 const memo=`THANHTOAN ${order.id}`,amount=Math.round(Number(order.total)||0);
 if(order.payment==='BANK')return {...paymentConfig,src:qrImage(paymentConfig.suppliedQrPayload),static:true,memo,amount};
 const payload=`GA GION\nMETHOD:${order.payment}\nORDER:${order.id}\nAMOUNT:${amount} VND\nMEMO:${memo}`;
 return {src:qrImage(payload),informational:true,memo,amount};
}

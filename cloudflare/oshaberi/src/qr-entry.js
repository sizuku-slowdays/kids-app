import QRCode from 'qrcode';
export const drawQR=(canvas,text)=>QRCode.toCanvas(canvas,text,{width:240,margin:2,errorCorrectionLevel:'M'});

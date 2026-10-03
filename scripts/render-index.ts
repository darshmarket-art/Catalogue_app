// The app ships dist/ as static files, so fill index.html's placeholders here the way the server does at request time.
import fs from 'node:fs';
import { loadMerchant, renderIndexHtml } from '../server/merchant.ts';

const file = 'dist/index.html';
const html = renderIndexHtml(fs.readFileSync(file, 'utf8'), loadMerchant());
if (html.includes('{{')) throw new Error('index.html still has unfilled placeholders');
fs.writeFileSync(file, html);

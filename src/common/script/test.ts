
import 'fs';
import * as bitmap from './bitmap'

const fs = require('fs')

var data = fs.readFileSync('images/book_a2600.png');
//var data = fs.readFileSync('images/print-head.png');
console.log(data);

var png = bitmap.png.decode(data);
console.log(png)


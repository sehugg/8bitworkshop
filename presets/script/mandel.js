
// slider UI objects
mx = ui.slider(0,2000).initial(1028)
my = ui.slider(0,2000).initial(1409)
ms = ui.slider(0,2000).initial(615)

// compute slider-derived values
xofs = (mx.value-1000)/500
yofs = (my.value-1000)/500
zoom = Math.pow(0.99, ms.value)

// create bitmap
fract = bitmap.indexed(512,256,8)

// compute fractal using assign()
fract.assign(mandel)

// mandelbrot pixel function
function mandel(x,y) {
  return iterateEquation(
    (x-fract.width/2)*zoom-xofs,
    (y-fract.height/2)*zoom-yofs, 10, 256)[0];
}

// mandelbrot compute function
function iterateEquation(Cr, Ci, escapeRadius, iterations)
{
  var Zr = 0;
  var Zi = 0;
  var Tr = 0;
  var Ti = 0;
  var n  = 0;
  for ( ; n<iterations && (Tr+Ti)<=escapeRadius; ++n ) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }
  for ( var e=0; e<4; ++e ) {
    Zi = 2 * Zr * Zi + Ci;
    Zr = Tr - Ti + Cr;
    Tr = Zr * Zr;
    Ti = Zi * Zi;
  }
  return [n, Tr, Ti];
}


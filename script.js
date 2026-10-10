// "view previous / new design" toggles used in the credible hub case study

function swapDesign(show, hide) {
  document.querySelectorAll('div.' + show).forEach(function (el) { el.style.display = 'block'; });
  document.querySelectorAll('div.' + hide).forEach(function (el) { el.style.display = 'none'; });
}

function showoldresources() { swapDesign('oldresources', 'newresources'); }
function shownewresources() { swapDesign('newresources', 'oldresources'); }
function showoldempty() { swapDesign('oldempty', 'newempty'); }
function shownewempty() { swapDesign('newempty', 'oldempty'); }
function showoldtile() { swapDesign('oldtile', 'newtile'); }
function shownewtile() { swapDesign('newtile', 'oldtile'); }
function showoldnav() { swapDesign('oldnav', 'newnav'); }
function shownewnav() { swapDesign('newnav', 'oldnav'); }

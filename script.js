$(window).scroll(function() {
  var scroll = $(window).scrollTop();
  if (scroll > 0) {
    $("#header").addClass("active");
  }
  else{
    $("#header").removeClass("active");
  }
});


var faq = document.getElementsByClassName("faq-page");
var i;

for (i = 0; i < faq.length; i++) {
    faq[i].addEventListener("click", function () {
        /* Toggle between adding and removing the "active" class,
        to highlight the button that controls the panel */
        this.classList.toggle("active");

        /* Toggle between hiding and showing the active panel */
        var body = this.nextElementSibling;
        if (body.style.display === "block") {
            body.style.display = "none";
        } else {
            body.style.display = "block";
        }
    });
}

function checkPswd() {
    var confirmPassword = "latte";
    var password = document.getElementById("pswd").value;
    if (password == confirmPassword) {
         window.location="lihp.html";
    }
    else{
        alert("Oops! Wrong password. Please try again.");
    }
}

function showoldresources() {
  $("div.oldresources").show();
  $("div.newresources").hide();
}

function shownewresources() {
  $("div.newresources").show();
  $("div.oldresources").hide();
}

function showoldempty() {
  $("div.oldempty").show();
  $("div.newempty").hide();
}

function shownewempty() {
  $("div.newempty").show();
  $("div.oldempty").hide();
}

function showoldtile() {
  $("div.oldtile").show();
  $("div.newtile").hide();
}

function shownewtile() {
  $("div.newtile").show();
  $("div.oldtile").hide();
}

function showoldnav() {
  $("div.oldnav").show();
  $("div.newnav").hide();
}

function shownewnav() {
  $("div.newnav").show();
  $("div.oldnav").hide();
}

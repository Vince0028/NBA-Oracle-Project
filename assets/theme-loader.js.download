(function () { 
  var initial = (localStorage && localStorage.theme) || '';
  var regex = document.location.search.match(/data-theme=(dark|light|WNBA)/);
  var theme = (regex) ? regex[1] : initial;
  if (theme && theme.length > 0) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  if (localStorage) {
    localStorage.theme = theme;
  }

})();

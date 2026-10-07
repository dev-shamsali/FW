(function () {
  var root = document.documentElement;
  var base = root.getAttribute("data-base") || "/docs/";

  /* theme: system -> light -> dark */
  var btn = document.getElementById("theme");
  function current() {
    try {
      return localStorage.getItem("rhea-theme") || "system";
    } catch {
      return "system";
    }
  }
  function apply(t) {
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    if (btn) {
      btn.setAttribute("aria-label", "Theme: " + t + ". Click to change.");
      btn.dataset.theme = t;
    }
  }
  apply(current());
  if (btn)
    btn.addEventListener("click", function () {
      var order = ["system", "light", "dark"],
        next = order[(order.indexOf(current()) + 1) % 3];
      try {
        if (next === "system") localStorage.removeItem("rhea-theme");
        else localStorage.setItem("rhea-theme", next);
      } catch {}
      apply(next);
    });

  /* copy buttons */
  document.querySelectorAll("button.copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var pre = b.closest("figure").querySelector("pre");
      var text = pre ? pre.innerText.replace(/\n$/, "") : "";
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
        function () {
          var l = b.querySelector("span");
          var old = l.textContent;
          l.textContent = "Copied";
          setTimeout(function () {
            l.textContent = old;
          }, 1600);
        },
        function () {},
      );
    });
  });

  /* on-this-page scroll spy */
  var links = [].slice.call(document.querySelectorAll(".toc a"));
  if (links.length && "IntersectionObserver" in window) {
    var map = {};
    links.forEach(function (a) {
      map[a.getAttribute("href").slice(1)] = a;
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) {
              a.classList.remove("on");
            });
            var a = map[e.target.id];
            if (a) a.classList.add("on");
          }
        });
      },
      { rootMargin: "-72px 0px -70% 0px" },
    );
    document.querySelectorAll("article h2[id], article h3[id]").forEach(function (h) {
      io.observe(h);
    });
  }

  /* mobile nav */
  var menu = document.getElementById("menu");
  if (menu)
    menu.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", String(open));
    });

  /* search: Ctrl/Cmd+K or / */
  var dlg = document.getElementById("search"),
    input = document.getElementById("q"),
    hits = document.getElementById("hits"),
    index = null;
  function load() {
    if (index) return Promise.resolve(index);
    return fetch(base + "search.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        index = j;
        return j;
      })
      .catch(function () {
        index = [];
        return index;
      });
  }
  function render(q) {
    hits.textContent = "";
    var phrase = q.toLowerCase().trim(),
      terms = phrase
        .split(/\s+/)
        .filter(Boolean)
        .map(function (w) {
          return w.length > 5 ? w.replace(/(ation|ing|ion|ed|es|e|s)$/, "") : w;
        });
    if (!terms.length) return;
    var scored = [];
    (index || []).forEach(function (e) {
      var h = e.h.toLowerCase(),
        t = e.t.toLowerCase(),
        hay = t + " " + h + " " + e.x.toLowerCase(),
        s = 0;
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return;
        if (new RegExp("\\b" + terms[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(h)) s += 4;
        else if (h.indexOf(terms[i]) !== -1) s += 2;
        if (t.indexOf(terms[i]) !== -1) s += 2;
        s += 1;
      }
      var joined = terms.join(" ");
      if (terms.length > 1) {
        if (h.indexOf(joined) !== -1) s += 12;
        else if (hay.indexOf(joined) !== -1) s += 8;
      }
      scored.push([s, e]);
    });
    scored.sort(function (a, b) {
      return b[0] - a[0];
    });
    if (!scored.length) {
      var li = document.createElement("li");
      li.className = "none";
      li.textContent = "No results for “" + q + "”";
      hits.appendChild(li);
      return;
    }
    scored.slice(0, 10).forEach(function (p) {
      var e = p[1],
        li = document.createElement("li"),
        a = document.createElement("a"),
        s = document.createElement("small");
      a.href = e.u;
      a.textContent = e.h || e.t;
      s.textContent = e.h ? e.t : "Page";
      a.appendChild(s);
      li.appendChild(a);
      hits.appendChild(li);
    });
  }
  function open() {
    if (!dlg) return;
    load().then(function () {
      render(input.value);
    });
    if (dlg.showModal) dlg.showModal();
    input.focus();
    input.select();
  }
  document.querySelectorAll("[data-open-search]").forEach(function (b) {
    b.addEventListener("click", open);
  });
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA")) {
      e.preventDefault();
      open();
    }
  });
  if (dlg) {
    input.addEventListener("input", function () {
      render(input.value);
    });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener("keydown", function (e) {
      var items = [].slice.call(hits.querySelectorAll("a")),
        i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (items[i + 1] || items[0] || input).focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        (i <= 0 ? input : items[i - 1]).focus();
      }
    });
  }
})();

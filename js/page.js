let pages = [window.location.pathname];
let switchDirectionWindowWidth = 900;
let animationLength = 200;
let nodeDataset = new vis.DataSet();
let edgeDataset = new vis.DataSet();
let isZoom = false;

var tempNetwork;

async function loadNetworkNodes() {
  let response = await fetch("./graph.json");
  let json = await response.json();
  var roamData = json;
  tempNetwork = new vis.Network(document.getElementById("temp-network"),
    {nodes: new vis.DataSet(roamData.nodes),
      edges: new vis.DataSet(roamData.edges)},
    {layout:{improvedLayout: false},
      physics:{enabled: false}});
  drawBufferNetwork(roamData);
}

function collectConnectedNodes(
  allNodes, baseNode, distance, alreadyConnected) {
  if (distance < 1) {
    return new Set([baseNode]); // base case for recursion
  }

  let connectedNodes = new Set([baseNode]);
  const neighbours = tempNetwork.getConnectedNodes(baseNode);

  for (let i = 0; i < neighbours.length; i++) {
    // Skip this node if we've already seen it. Helps with the performance.
    if (alreadyConnected && alreadyConnected.has(neighbours[i])) continue;
    var neighbourConnectedNodes = collectConnectedNodes(
      allNodes, neighbours[i], distance - 1, connectedNodes);
    for (let node of neighbourConnectedNodes) {
      connectedNodes.add(node);
    }
  }
  return connectedNodes;
}

function drawBufferNetwork(roamData) {
  const nodeDataset = new vis.DataSet(roamData.nodes);
  const nodes = nodeDataset.get({returnType:"Object"});
  const connectedNodes = Array.from(
    collectConnectedNodes(nodes, currentNode, 1));
  console.log(connectedNodes);
  let bufferNodes = [];
  for (let i = 0; i < connectedNodes.length; i++) {
    bufferNodes.push(nodes[connectedNodes[i]]);
  }
  const bufferContainer = document.getElementById("buffer-network");
  console.log(bufferNodes);
  console.log(roamData.edges);
  let options = {              nodes: {shape: "dot"},
    interaction: {hover: true},
    layout: {improvedLayout: true}};
  bufferNetwork = new vis.Network(
    bufferContainer,
    {nodes:bufferNodes,
      edges:roamData.edges},
    options
  );
}

function stackNote(href, level) {
  level = Number(level) || pages.length;
  href = URI(href);
  uri = URI(window.location);
  stacks = [];
  if (uri.hasQuery("stackedNotes")) {
    stacks = uri.query(true).stackedNotes;
    if (!Array.isArray(stacks)) {
      stacks = [stacks];
    }
    stacks = stacks.slice(0, level - 1);
  }
  stacks.push(href.path());
  uri.setQuery("stackedNotes", stacks);

  old_stacks = stacks.slice(0, level - 1);
  state = { stacks: old_stacks, level: level };
  window.history.pushState(state, "", uri.href());
}

function unstackNotes(level) {
  let container = document.querySelector(".grid");
  let children = Array.prototype.slice.call(container.children);

  for (let i = level; i < pages.length; i++) {
    container.removeChild(children[i]);
    destroyPreviews(children[i]);
  }
  pages = pages.slice(0, level);
}

function fetchNote(href, level, animate = false) {
  level = Number(level) || pages.length;

  const request = new Request(href);
  fetch(request)
    .then((response) => response.text())
    .then((text) => {
      unstackNotes(level);
      let container = document.querySelector(".grid");
      let fragment = document.createElement("template");
      fragment.innerHTML = text;
      let element = fragment.content.querySelector(".page");
      container.appendChild(element);
      pages.push(href);

      setTimeout(
        function (element, level) {
          element.dataset.level = level + 1;
          initializePreviews(element, level + 1);
          element.scrollIntoView();
          if (animate) {
            element.animate([{ opacity: 0 }, { opacity: 1 }], animationLength);
          }

          if (window.MathJax) {
            window.MathJax.typeset();
          }
        }.bind(null, element, level),
        10
      );

      updateLinkStatuses();
    });
}

function updateLinkStatuses() {
  let links = Array.prototype.slice.call(
    document.querySelectorAll("a[data-uuid]")
  );

  links.forEach(function (link) {
    if (pages.indexOf(link.dataset.uuid) !== -1) {
      link.classList.add("linked");
      if (link._tippy) link._tippy.disable();
    } else {
      link.classList.remove("linked");
      if (link._tippy) link._tippy.enable();
    }
  });
}

function destroyPreviews(page) {
  links = Array.prototype.slice.call(page.querySelectorAll("a[data-uuid]"));
  links.forEach(function (link) {
    if (link.hasOwnProperty("_tippy")) {
      link._tippy.destroy();
    }
  });
}

let tippyOptions = {
  allowHTML: true,
  theme: "light",
  interactive: true,
  interactiveBorder: 10,
  delay: 500,
  touch: ["hold", 500],
  maxWidth: "none",
  inlinePositioning: false,
  placement: "right",
};

function createPreview(link, html, overrideOptions) {
  level = Number(link.dataset.level);
  iframe = document.createElement("iframe");
  iframe.width = "480px";
  iframe.height = "360px";
  iframe.srcdoc = html;
  tip = tippy(
    link,
    Object.assign(
      {},
      tippyOptions,
      {
        content: iframe.outerHTML
        // '<iframe width="400px" height="300px" srcdoc="' +
        //     escape(html) +
        // '"></iframe>',
      },
      overrideOptions
    )
  );
}

function initializePreviews(page, level) {
  level = level || pages.length;

  links = Array.prototype.slice.call(page.querySelectorAll("a:not(.rooter)"));

  links.forEach(async function (element) {
    var rawHref = element.getAttribute("href");
    element.dataset.level = level;

    if (
      rawHref &&
      !(
          rawHref.indexOf("http://") === 0 ||
          rawHref.indexOf("https://") === 0 ||
          rawHref.indexOf("#") === 0 ||
          rawHref.includes(".pdf") ||
          rawHref.includes(".svg")
        )
    ) {
      var prefetchLink = element.href;
      async function myFetch() {
        let response = await fetch(prefetchLink);
        let fragment = document.createElement("template");
        fragment.innerHTML = await response.text();
        let ct = await response.headers.get("content-type");
        if (ct.includes("text/html")) {
          createPreview(element, fragment.content.querySelector(".page").outerHTML, {
            placement:
                    window.innerWidth > switchDirectionWindowWidth
                      ? "right"
                      : "top",
          });

          element.addEventListener("click", function (e) {
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              stackNote(element.href, this.dataset.level);
              fetchNote(element.href, this.dataset.level, (animate = true));
            }
          });
        }
      }
      return myFetch();
    }
  });
}

window.addEventListener("popstate", function (event) {
  // TODO: check state and pop pages if possible, rather than reloading.
  window.location = window.location; // this reloads the page.
});

window.onload = function () {
  //loadNetworkNodes();
  initializePreviews(document.querySelector(".page"));
  zoomImage();
  hljs.highlightAll();

  uri = URI(window.location);
  if (uri.hasQuery("stackedNotes")) {
    stacks = uri.query(true).stackedNotes;
    if (!Array.isArray(stacks)) {
      stacks = [stacks];
    }
    for (let i = 1; i <= stacks.length; i++) {
      fetchNote(stacks[i - 1], i);
    }
  }
};

// Image zoom
// ---------------------------------
function zoomImage() {
    $("img").each(function(idx, ele) {
        $(this).click(function() {

            if(!isZoom) {
                $("html").append(
                    `
                    <div class='img-wrapper animated pulse faster'>
                        <img class='img-zoom' src=${ele.src} />
                    </div>
                    `
                );

                $(".img-wrapper").click(function() {
                    $(".img-wrapper").remove();
                    isZoom = false;
                });

                isZoom = true;
            }
        });
    });
}

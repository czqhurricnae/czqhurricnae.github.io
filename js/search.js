// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-v3-or-Later
// How many characters to include on either side of match keyword
const summaryInclude=60;

// Options for fuse.js
let fuseOptions = {
    shouldSort: true,
    includeMatches: true,
    tokenize: true,
    matchAllTokens: true,
    threshold: 0.0,
    location: 0,
    distance: 100,
    maxPatternLength: 64,
    minMatchCharLength: 3,
    keys: [
        {name:"title",weight:0.8},
        {name:"tags",weight:0.5},
        {name:"categories",weight:0.5},
        {name:"contents",weight:0.4}
    ]
};

let data = document.querySelector('#data').innerText;
let arr = data.split('ⓈⓈⓈ');
let map = [];
let scVal = '';

arr.forEach(item => {
    let _arr = item.split('ⒷⒷ');
    if (!_arr[3]) {
        return;
    }
    map.push({
        title: _arr[0].trim(),              // 标题
        permalink: _arr[1],					// 链接
        date: _arr[2],
        content: _arr[3],
        lowCaseContent: _arr[3].toLowerCase()	// 信息串，包含页面所有信息
    })
})

function scanStr(content, str) {        // content 页面内容信息串
    let index = content.toLowerCase().indexOf(str);   // str     出现的位置
    let num = 0;                        // str     出现的次数
    let arrIndexAndSegment = [];                  // str     出现的位置集合

    while(index !== -1) {
        arrIndexAndSegment.push({index: index, segment: content.substr(index, str.length)});
        num += 1;
        index = content.toLowerCase().indexOf(str, index + 1); // 从 str 出现的位置下一位置继续
    }

    return arrIndexAndSegment;
}

// ==========================================
// fetch some json without jquery
//
function fetchJSONFile(path, callback) {
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                var data = JSON.parse(httpRequest.responseText);
                if (callback) callback(data);
            }
        }
    };
    httpRequest.open('GET', path);
    httpRequest.send();
}

function displayResults(results, store) {
  const searchResults = document.getElementById("results");
  if (results.length) {
    let resultList = "<h3 class='search-count'>" + results.length + " results found</h3>";
    // Iterate and build result list elements
    for (const n in results) {
      const item = store[results[n].ref];
      resultList +=
        '<li><a href="' + item.url + '">' + item.title + "</a>";
      resultList += "<span class='search-extract'>" + item.content.substring(0, 100) + "...</span></li>";
    }
    searchResults.innerHTML = resultList;
  } else {
    searchResults.innerHTML = "No results found.";
  }
}

function executeSearch(searchQuery) {
    // Look for "index.json" in the same directory where this script is called.
    fetchJSONFile('/index.json', function(data) {
        var options = { // fuse.js options; check fuse.js website for details
            shouldSort: true,
            location: 0,
            distance: 100,
            threshold: 0.4,
            minMatchCharLength: 2,
            keys: [
                'permalink',
                'title',
                'tags',
                'contents'
            ]
        };
        // Create the Fuse index
        fuseIndex = Fuse.createIndex(options.keys, data)
        fuse = new Fuse(data, options, fuseIndex); // build the index from the json file
        let result = fuse.search(searchQuery);
        if (result.length > 0) {
            populateResults(result);
        } else {
            document.getElementById('results').innerHTML = "<p class=\"no-results\">No matches found</p>";
        }
    });
}

// Get the query parameter(s)
const params = new URLSearchParams(window.location.search);
const searchQuery = params.get("query");

// Perform a search if there is a query
if (searchQuery) {
  // Retain the search input in the form when displaying results
  document.getElementById("search-input").setAttribute("value", searchQuery);

  console.log(window.store);

  // executeSearch(searchQuery);
  search(searchQuery);
}

function populateResults(result){
  result.forEach( function (value, key) {
    let contents= value.item.contents;
    let snippet = "";
    let snippetHighlights=[];
    snippetHighlights.push(searchQuery);
    if(snippet.length<1){
      var getSentenceByWordRegex = new RegExp(
        `[^.?!]*(?<=[.?\\s!])${searchQuery}(?=[\\s.?!])[^.?!]*[.?!]`,
        'i'
      );
      var maxTextLength = summaryInclude*2
      // Index of the matched search term
      var indexOfMatch = contents.toLowerCase().indexOf(
        searchQuery.toLowerCase()
      );
      // Index of the first word of the sentence with the search term in it
      var indexOfSentence = contents.indexOf(
        getSentenceByWordRegex.exec(contents)
      );

      var start
      var cutStart = false
      // Is the match in the result?
      if(indexOfSentence+maxTextLength < indexOfMatch){
        // Make sure that the match is in the result
        start = indexOfMatch
        // This bool is used to replace the first part with '...'
        cutStart = true
      } else {
        // Match is in view, even if we show the whole sentence
        start = indexOfSentence
      }

      // Change end length to the text length if it is longer than
      // the text length to prevent problems
      var end = start + maxTextLength
      if (end > contents.length){
        end = contents.length
      }

      if(cutStart){
        // Replace first three characters with '...'
        end -= 3;
        snippet += "…" + contents.substring(start, end).trim();
      }
      else{
        snippet += contents.substring(start, end).trim();
      }
    }
    snippet += "…";

    // Lifted from https://stackoverflow.com/posts/3700369/revisions
    var elem = document.createElement('textarea');
    elem.innerHTML = snippet;
    var decoded = elem.value;

    // Pull template from hugo template definition
    let frag = document.getElementById('search-result-template').content.cloneNode(true);
    // Replace values
    frag.querySelector(".search_summary").setAttribute("id", "summary-" + key);
    frag.querySelector(".search_link").setAttribute("href", value.item.permalink);
    frag.querySelector(".search_title").textContent = value.item.title;
    frag.querySelector(".search_snippet").textContent = decoded;
    let tags = value.item.tags;
    if (tags) {
      frag.querySelector(".search_tags").textContent = tags;
    } else {
      frag.querySelector(".search_iftags").remove();
    }
    let categories = value.item.categories;
    if (categories) {
      frag.querySelector(".search_categories").textContent = categories;
    } else {
      frag.querySelector(".search_ifcategories").remove();
    }
    snippetHighlights.forEach( function (snipvalue, snipkey) {
      let markjs = new Mark(frag);
      markjs.mark(snipvalue);
    });
    document.getElementById("results").innerHTML = frag;
    // document.getElementById("results").appendChild(frag);
  });
}

function search(searchQuery) {
    let post = '';
    scVal = searchQuery.trim().toLowerCase();

    map.forEach(item => {
        if (!scVal) return;
        if (item.lowCaseContent.indexOf(scVal) > -1) {
            let _arrIndex = scanStr(item.content, scVal);
            let strRes = '';
            let _radius = 100;  // 搜索字符前后截取的长度
            let _strStyle0 = '<span style="background: yellow;">'
            let _strStyle1 = '</span>'
            let _strSeparator = '<hr>'


            // 统计与首个与其前邻的索引（不妨称为基准索引）差值小于截取半径的索引位小于截取半径的索引的个数
            // 如果差值小于半径，则表示当前索引内容已包括在概要范围内，则不重复截取，且
            // 下次比较的索引应继续与基准索引比较，直到大于截取半径， _count重新置 为 0；
            let _count = 0;

            for (let i = 0, len = _arrIndex.length; i < len; i++) {
                let _idxItem = _arrIndex[i].index;
                let _relidx = i;


                // 如果相邻搜索词出现的距离小于截取半径，那么忽略后一个出现位置的内容截取（因为已经包含在内了）
                if (_relidx > 0 && (_arrIndex[_relidx].index - _arrIndex[_relidx - 1 - _count].index < _radius)) {
                    _count += 1;
                    continue;
                }
                _count = 0;

                // 概要显示
                // _startIdx, _endIdx 会在超限时自动归限（默认，无需处理）
                strRes += _strSeparator;
                let _startIdx = _idxItem - _radius + (_relidx + 1) * _strSeparator.length;
                let _endIdx = _idxItem + _radius + (_relidx + 1) * _strSeparator.length;
                strRes +=  item.content.substring(_startIdx, _endIdx);
            }

            // 进一步对搜索摘要进行处理，高亮搜索词
            let _arrStrRes = scanStr(strRes, scVal);
            for (let i = 0, len = _arrStrRes.length; i < len; i++) {
                let _idxItem = _arrStrRes[i].index;
                let _realidx = i;

                strRes =
                    strRes.slice(0, (_idxItem + _realidx * (_strStyle0.length + _strStyle1.length))) +          // 当前索引位置之前的部分
                    _strStyle0 + _arrStrRes[i].segment + _strStyle1 +
                    strRes.slice(_idxItem + scVal.length + _realidx * (_strStyle0.length + _strStyle1.length)); // 之后的部分
            }

            post += `
                <div style="margin-top: 24px" >
                    <a href="${item.permalink}">
                        <span>📄</span>
                        <span>${item.title}</span>
                    </a>
                        <span style="
                        color: #999;
                        font-size:.12rem;
                        font-family: segoe script,segoeFont,courier new;
                        margin-left: 4px;">
                            ${item.date}
                        </span>
                    <div>${strRes}</div>
                </div>
            `
        }
    })
    if (post) {
        document.getElementById("results").innerHTML= post;
    } else {
        document.getElementById('results').innerHTML = "<p class=\"no-results\">No matches found</p>";
    }
}

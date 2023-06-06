const window = global.window;
const Server = {
  settings: { progress: 10, loggedInUser: false, isInProgress: false, totalConnections: 0, isCollectedDone: false, connections: [] },
  async init() {
    this.settings.loggedInUser = await this.getLoggedInUser()
  },
  getCleanedName(name = "") {
    let romanNumbers = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    let startWith = ['(', '{', '[', '-'];
    let splits = name.split(" ");
    for (let word of splits) {
      if (romanNumbers.find(rmn => rmn == (word.replace(/,/g, '')))) return name;
    }
    splits = name.split(" - ");
    if (splits.length >= 2) {
      if (/[A-Z]{2}/.test(splits[1])) return splits[0];
      else if (/[A-Z]{1}[a-z]{1}[A-Z]{1}/.test(splits[1])) return splits[0]
      else if (splits.length > 2) return splits[0]
      else if (!(/[A-Z]{2}/.test(splits[1])) || (/[A-Z]{1}[a-z]{1}[A-Z]{1}/.test(splits[1]))) return splits[0]
      else if (startWith.includes(splits[1][0])) return splits[0]
      else return splits[0] + " " + splits[1];
    }
    splits = name.split(",");
    if (splits.length >= 2) {
      if (/[A-Z]{2}/.test(splits[1])) return splits[0].split(" ")[0];
      else if (/[A-Z]{1}[a-z]{1}[A-Z]{1}/.test(splits[1])) return splits[0]
      else if (splits.length > 2) return splits[0]
      else if (!(/[A-Z]{2}/.test(splits[1])) || !(/[A-Z]{1}[a-z]{1}[A-Z]{1}/.test(splits[1]))) return splits[0].split(" ")[0]
      else if (startWith.includes(splits[1][0])) return splits[0].split(" ")[0]
      else if (/[A-Z]{1}[a-z]/.test(splits[1])) return splits.join(" ");
      else return splits.join(" ");
    }
    name = name.replace(/,/g, '');
    splits = name.split(" ");
    if (splits.length >= 2) {

      if (/[A-Z]{2}/.test(splits[1])) return splits[0];
      else if (/[A-Z]{1}[a-z]{1}[A-Z]{1}/.test(splits[1])) return splits[0]
      else if (startWith.includes(splits[1][0])) return splits[0]
      else return splits.join(" ");
    } else return splits[0];
  },
  getLoggedInUser() {
    return new Promise(async (resolve) => {
      try {
        if (this.settings.loggedInUser) return resolve(this.settings.loggedInUser);
        const resp = await this.fetchLinkedInUrl('https://www.linkedin.com/voyager/api/identity/profiles/me', true);
        if (!resp) {
          return resolve(false);
        }
        const result = {
          firstName: resp.firstName,
          lastName: resp.lastName,
          country: resp.geoCountryName,
          headline: resp.headline,
          summary: resp.summary,
          entityUrn: resp.entityUrn,
          industryName: resp.industryName,
          profileId:
            resp.entityUrn &&
            resp.entityUrn
              .replace('urn:li:fsd_profile:', '')
              .replace('urn:li:fs_profile:', ''),
          location: resp.geoLocationName,
          publicIdentifier: resp.miniProfile && resp.miniProfile.publicIdentifier,
          memberId:
            resp &&
            resp.miniProfile &&
            resp.miniProfile.objectUrn.replace('urn:li:member:', ''),
          profilePicture:
            resp.miniProfile &&
            resp.miniProfile.picture &&
            resp.miniProfile.picture['com.linkedin.common.VectorImage'] &&
            resp.miniProfile.picture['com.linkedin.common.VectorImage'].rootUrl +
            resp.miniProfile.picture['com.linkedin.common.VectorImage']
              .artifacts[2].fileIdentifyingUrlPathSegment,
        };
        this.settings.loggedInUser = result;
        console.log(this.settings.loggedInUser)
        return resolve(result);
      } catch (e) {
        console.log(e);
        return resolve(false);
      }
    });
  },
  async getNumberOfConnections() {
    let response = await this.fetchLinkedInUrl(`https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-193&count=0&origin=Communities&q=all&query=(queryParameters:(resultType:List(ALL)),flagshipSearchIntent:MYNETWORK_CURATION_HUB)&start=0`, true)
    console.log(response);
    return (response?.metadata?.primaryFilterCluster?.primaryFilters[0]?.primaryFilterValues.find(x => x.value == "CONNECTIONS"))?.count || 0
  },
  async hasLiAt() {
    const li_at = await chrome.cookies.get({
      url: 'https://www.linkedin.com',
      name: 'li_at',
    });
    return li_at !== null;
  },
  getCsrfToken() {
    return new Promise((resolve) => {
      chrome.cookies.get({
        url: 'https://www.linkedin.com',
        name: 'JSESSIONID',
      }, csrf => {
        // console.log(csrf);
        if (csrf && csrf.value) {
          return resolve(csrf.value.startsWith('"') ? csrf.value.slice(1, -1) : csrf.value);
        } else {
          return resolve(false);
        }
      });
    });
  },
  async fetchLinkedInUrl(url, withAcceptHeader = false, method = 'GET', body = null, hreaders = {}) {
    try {
      if (body) body = JSON.stringify(body);
      const csrfToken = await this.getCsrfToken();
      const li_at = await this.hasLiAt();
      if (!csrfToken && !li_at) return false;
      const headers = withAcceptHeader
        ? {
          'x-restli-protocol-version': '2.0.0',
          'csrf-token': csrfToken,
          'x-li-track':
            '{"clientVersion":"1.5.*","osName":"web","timezoneOffset":1,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
          ...hreaders
        }
        : {
          accept: 'application/vnd.linkedin.normalized+json+2.0',
          'x-restli-protocol-version': '2.0.0',
          'csrf-token': csrfToken,
          'x-li-track':
            '{"clientVersion":"1.5.*","osName":"web","timezoneOffset":1,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
          ...hreaders
        };

      if (!url.startsWith("https://www.linkedin.com/")) url = `https://www.linkedin.com${url}`
      const res = await fetch(url, {
        method: method,
        headers: headers,
        body,
        credentials: 'include',
      });
      const text = await res.text();
      const data = JSON.parse(text);
      return data;
    } catch (e) {
      console.log(e);
      return false;
    }
  },
  cleanName(name) {
    return (name.replace(/[^\\"]"/g, '\"').replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\!|\"|\$|\%|\&|\/|\(|\)|\)|\=|\?|\¿|\¡|\^|\*|\:|\_|\~|)/g, "")).trim();
  },
  removeEmojies(text) {
    let emojiStrip = function (u) { function D(E) { if (F[E]) return F[E].exports; var C = F[E] = { i: E, l: !1, exports: {} }; return u[E].call(C.exports, C, C.exports, D), C.l = !0, C.exports } var F = {}; return D.m = u, D.c = F, D.i = function (u) { return u }, D.d = function (u, F, E) { D.o(u, F) || Object.defineProperty(u, F, { configurable: !1, enumerable: !0, get: E }) }, D.n = function (u) { var F = u && u.__esModule ? function () { return u.default } : function () { return u }; return D.d(F, "a", F), F }, D.o = function (u, D) { return Object.prototype.hasOwnProperty.call(u, D) }, D.p = "", D(D.s = 1) }([function (u, D, F) { "use strict"; u.exports = function () { return /(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC69\uDC6E\uDC70-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD26\uDD30-\uDD39\uDD3D\uDD3E\uDDD1-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])?|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDEEB\uDEEC\uDEF4-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267B\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEF8]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD4C\uDD50-\uDD6B\uDD80-\uDD97\uDDC0\uDDD0-\uDDE6])\uFE0F/g } }, function (u, D, F) { function E(u) { return u.replace(A, "") } var C = F(0), A = C(); u.exports = E }]);
    return emojiStrip(text);
  },
  removeSpecialChars(txt) {
    return txt.replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|\!|\$|\%|\&|\/|\=|\?|\¿|\¡|\^|\*|\:|\_|\~|)/g, "").trim()
  },
  cleanDesignations(name) {
    let list = [
      "CIO/CTO",
      "CIPP/US",
      "IHRP-CP",
      "LFHIMSS",
      "SHRM-CP",
      "B.E.P.",
      "BABTAC",
      "C.P.M.",
      "CFP(R)",
      "CIMA¬Æ",
      "CMFC¬Æ",
      "CMPS¬Æ",
      "CPFA¬Æ",
      "CRPC¬Æ",
      "D.B.A.",
      "G.S.D.",
      "L.I.O.N.",
      "GASPAR",
      "M.B.A.",
      "MS-ITM",
      "P.Eng.",
      "AIF¬Æ",
      "B.Eng",
      "B.Sc.",
      "CBISO",
      "CeMAP",
      "CFP¬Æ",
      "CISSP",
      "CLU¬Æ",
      "CMB¬Æ",
      "CSCMP",
      "FASLA",
      "FHFMA",
      "GAICD",
      "M.B.A",
      "M.Ed.",
      "MAMFT",
      "MCIPD",
      "MFA-P",
      "MRCSA",
      "MSHCA",
      "Ph.B.",
      "Ph.D.",
      "PMP¬Æ",
      "RCS-d",
      "TOGAF",
      "ACSI",
      "APSC",
      "ASPC",
      "AWMA",
      "B.A.",
      "bCRE",
      "C.M.",
      "CAIA",
      "CCHP",
      "CCLP",
      "CCSK",
      "CCXP",
      "CDCD",
      "CDLP",
      "CEPA",
      "CFCI",
      "CFTe",
      "ChFC",
      "CHRE",
      "CHVA",
      "CIEC",
      "CIPM",
      "CISA",
      "CISM",
      "CLCS",
      "CLFP",
      "CMSS",
      "CPBB",
      "CPCC",
      "CPCO",
      "CPCP",
      "CPCU",
      "CPPL",
      "CPSM",
      "CRCE",
      "CRCP",
      "CRIS",
      "CRMP",
      "CRPS",
      "CRSP",
      "CSBO",
      "CSCP",
      "CSME",
      "DBIA",
      "DCIS",
      "EMBA",
      "eMBA",
      "F.ISP",
      "FCAS",
      "FCCA",
      "FEPS",
      "FICB",
      "FIRP",
      "FISP",
      "FLMI",
      "FPQP",
      "ICAE",
      "IHRP",
      "J.D.",
      "LCHB",
      "LMFT",
      "M.A.",
      "M.D.",
      "M.M.",
      "M.S.",
      "MHSA",
      "MMIS",
      "MScA",
      "MSEE",
      "MSFS",
      "MSIA",
      "MSIT",
      "MSOD",
      "MSSW",
      "P.E.",
      "Ph.D",
      "RCDD",
      "RIBA",
      "RICP",
      "SAFe",
      "SHRM",
      "SPHR",
      "SPLP",
      "USMC",
      "ACC",
      "AIA",
      "AIC",
      "AIS",
      "AMP",
      "APR",
      "BBA",
      "BSB",
      "BSc",
      "BSC",
      "BSN",
      "BST",
      "CAE",
      "CBP",
      "CCE",
      "CCM",
      "CCS",
      "CDM",
      "CDP",
      "CDS",
      "CEM",
      "CEO",
      "CFA",
      "CFE",
      "CFI",
      "CFP",
      "CHA",
      "CHB",
      "CIC",
      "CID",
      "CKM",
      "CLF",
      "CLU",
      "CMA",
      "CMC",
      "CMP",
      "CMS",
      "CPA",
      "CPC",
      "CPM",
      "CPP",
      "CPT",
      "CRE",
      "CRP",
      "CSI",
      "CSM",
      "CSP",
      "CTB",
      "CTP",
      "CTS",
      "DBA",
      "DBH",
      "DTL",
      "ICF",
      "IGP",
      "J.D",
      "LCB",
      "LLB",
      "MBA",
      "MCM",
      "MHA",
      "MHP",
      "MIH",
      "MLD",
      "MPA",
      "MPH",
      "MPM",
      "MPS",
      "MSA",
      "MSc",
      "MSC",
      "MSF",
      "MSL",
      "MSM",
      "MSW",
      "PCC",
      "PhD",
      "PHR",
      "PMP",
      "PMT",
      "QKA",
      "QKC",
      "QPA",
      "RHU",
      "RTE",
      "SCP",
      "SEM",
      "SPC",
      "TRS",
      "UAV",
      "USA",
      "BA",
      "CM",
      "CP",
      "CR",
      "DC",
      "JD",
      "LC",
      "MA",
      "MD",
      "MS",
      "PC",
      "PE",
      "RD",
      "RN",
      "SP"
    ].sort((a, b) => b.length - a.length);;
    let tempName = name;//.replace(/(\.)/gm, "");
    for (let dest of list) {
      let index = tempName.indexOf(dest);
      if (index != -1) {
        if (index == 0) return "";
        let char = tempName.slice(index - 1, index);
        if ([" ", "-", "(", "[", "{"].includes(char)) {
          tempName = tempName.substr(0, index - 1);
          return this.cleanDesignations(tempName)
          //tempName = tempName.replaceAll(dest, "");
          //tempName = startingName
        }
      }

    }
    return tempName.trim();
  },
  removeKeywords(txt = "") {
    let list = [
      /\((dev)\)/,
      /\((he\/him)\)/i,
      /\((she\/her)\)/i,
      /\((they\/them)\)/i,
      /\((she\/they)\)/i,
      /\((he\/they)\)/i,
      /\((they\/she)\)/i,
      /\((they\/he)\)/i,
      /\((he)\)/i,
      /\((she)\)/i,
      /\((they)\)/i,
      /\((she)\)/i,
      /\((he)\)/i,
      /\((they)\)/i,
      /\((him)\)/i,
      /\((her)\)/i,
      /\((them)\)/i
    ];
    for (let term of list) {
      if (txt.match(term)) txt = txt.replace(term, "").replace("()", "").replace("( )", "").trim()
    }
    return txt.trim();
  },
  capitalize(str) {
    let joinWith = " ", arr = str.split(" ");
    if (arr.length == 1) {
      joinWith = "-";
      arr = str.split("-")
    }
    for (let i in arr) {
      if (arr[i].endsWith("-")) arr[i] = arr[i].slice(0, -1)
      if (arr[i].startsWith("(") || arr[i].startsWith("'") || arr[i].startsWith(`"`) || arr[i].match(/-[A-Z]{1}/)) continue;
      arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1).toLowerCase();
    }
    str = arr.join(joinWith);
    if (str.length == 1) str = str.toUpperCase() + ".";
    return str;
  },
  cleanLastName: function (text) {
    let txt = this.removeEmojies(text);
    txt = this.removeSpecialChars(text);
    txt = this.cleanDesignations(txt).replace(/[^\\"]"/g, '\"');
    if (txt.match(/(\. | -|- |,|‚|\.\/|\r\n|\n)/)) {
      txt = (txt.replace(/(\. | -|- |,|‚|\.\/|\r\n|\n)/gm, " ")).split(" ");
      let name = "";
      for (let i in txt) {
        let word = txt[i];
        if (word.startsWith("'") && i == 0 && word.length == 2) { name = text.substr(1); break; }
        if ((word.replace(/[^a-zA-Z]/g, "")).length >= 2) { name = word; break; }
      }
      if (!name) name = txt[0];
      txt = name.trim();
    } else {
      let splits = txt.split(" ");
      if (splits.length >= 4) txt = splits[0].trim();
    }
    if (txt.startsWith(`'`) || txt.startsWith(`"`)) txt = txt.substr(1);
    if (txt.endsWith(`'`) || txt.endsWith(`"`)) txt = txt.replace(/'(.*?)'|"(.*?)"/g, "");
    txt = (txt.replace("()", "").replace("( )", "").replace("' ", " ").replace(/"/g, "")).trim();
    if (txt.length == 1) {
      if (txt.match(/[^a-zA-Z]/g)) txt = txt.replace(/[^a-zA-Z ]/g, "");
      else if (txt.match(/[a-zA-Z]/g)) txt = txt.toUpperCase() + ".";
    }
    txt = this.capitalize(txt);
    return txt;
  },
  cleanFirstName: function (text) {
    let txt = this.removeKeywords(text)
    txt = this.cleanName(txt);
    let len = txt.match(/[a-zA-z]/g);
    if (len && len.length == 2) {
      return txt.trim();
    }
    if (txt.includes(".")) txt = txt.replace(/\./g, ". ");
    txt = this.capitalize(txt);
    return txt.trim()
  },
  collectConnection() {
    let start = 0, count = 1000, progress = 1;
    Server.settings.progress = progress;
    this.sendBG({ cmd: "updateProgress", progress });
    const startCollecting = async () => {
      let api = `https://www.linkedin.com/voyager/api/relationships/dash/connections?count=${count}&start=${start}&decorationId=com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-5&q=search&sortType=RECENTLY_ADDED`
      if (!this.settings.isInProgress) return this.stopProcess();
      let response = await this.fetchLinkedInUrl(api, true);
      console.log(response);
      if (response?.elements?.length) {

        for (let conn of response.elements) {
          if (conn.connectedMemberResolutionResult) {
            let {
              uniqueProfileID = "",
              originalFirstName = "",
              originalLastName = "",
              originalFullName = "",
              fullName = "", entityUrn,
              firstName, lastName,
              profilePicture,
              publicIdentifier,
              headline = "",
              profileUrl = "", profilePhoto = "", connectedOn = "",
              additionalNote = ""

            } = conn.connectedMemberResolutionResult;
            originalFullName = firstName + " " + lastName;
            originalFirstName = firstName;
            originalLastName = lastName;
            lastName = this.cleanLastName(this.removeKeywords(lastName));
            firstName = this.cleanFirstName(firstName);
            //lastName = this.cleanName(lastName);
            fullName = firstName + " " + lastName;
            profileUrl = `https://www.linkedin.com/in/${publicIdentifier}/`;
            uniqueProfileID = entityUrn.replace("urn:li:fsd_profile:", "");
            connectedOn = conn.createdAt;
            additionalNote = profilePicture?.frameType || "";
            if (profilePicture?.displayImageReference?.vectorImage) {
              let vectorImage = profilePicture?.displayImageReference?.vectorImage;
              profilePhoto = vectorImage.rootUrl + vectorImage.artifacts[0].fileIdentifyingUrlPathSegment;
            }
            this.settings.connections.push({
              uniqueProfileID, fullName, firstName, lastName, originalFullName, originalFirstName, originalLastName, publicIdentifier, headline, profileUrl, profilePhoto, connectedOn, additionalNote
            })
          }
        }
        console.log(this.settings.connections)
        this.settings.progress = (this.settings.connections.length / this.settings.totalConnections) * 100;
        this.sendBG({ cmd: "updateProgress", progress: this.settings.progress });
        start += count;
        if (this.settings.connections.length == this.settings.totalConnections) return this.stopProcess();
        return startCollecting();
      }
      this.stopProcess();

    }
    startCollecting();
  },
  stopProcess() {
    this.settings.isInProgress = false;
    this.settings.isCollectedDone = true;
    this.sendBG({ cmd: "updateUI", settings: this.settings });
  },
  async sendBG(data) {
    let respond = await chrome.runtime.sendMessage(data);
    chrome.runtime.lastError;
    return respond;
  },
}
Server.init();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  console.log(message)
  switch (message.cmd) {
    case 'startProcess': Server.settings.isInProgress = true; Server.settings.isCollectedDone = false; Server.settings.connections = []; Server.collectConnection(); respond(Server.settings); return true;
    case 'updateSettings': Server.settings = { ...Server.settings, ...message.settings }; respond(Server.settings); return true;
    case 'gettingSettings': Server.hasLiAt().then(async hasLiAt => (await Server.getLoggedInUser(), Server.settings.hasLiAt = hasLiAt, respond(Server.settings))); return true;
    case "getNumOfConns": Server.getNumberOfConnections().then(num => (Server.settings.totalConnections = num, respond(num))); return true;
  }
});


chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == 'install') {
      chrome.runtime.setUninstallURL('https://forms.gle/geEVBN4j67cBCX129');
  } else if (details.reason == 'update') {
      // chrome.runtime.setUninstallURL('https://www.yourwebsite.com/uninstall');
  }
});

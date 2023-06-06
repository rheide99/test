const Popup = {
    settings: {},
    async sendBG(data:any) {
        let respond = await chrome.runtime.sendMessage(data);
        chrome.runtime.lastError;
        return respond;
    },
    async init() {
        this.$loginPanel = $('#logged-in');
        this.$homePanel = $('#logged-in #initial-state');
        this.$progressPanel = $('#logged-in #running-state');
        this.$downloadPanel = $('#logged-in #download-state');
        this.$logoutPanel = $('#logged-out');
        this.sendBG({ cmd: "getNumOfConns" }).then((totalConnections:any) => {
            this.settings.totalConnections = totalConnections;
            this.manageTemplates();
        })
        this.settings = await this.sendBG({ cmd: "gettingSettings" });
        //this.settings.isInProgress = true;
        //this.settings.isCollectedDone = true;this.settings.connections=[1,2,3];
        console.log(this.settings);
        this.manageTemplates();
        this.$homePanel.find('#collect-btn').click(() => {
            if (this.settings.totalConnections) {
                this.settings.isInProgress = true;
                this.settings.isCollectedDone = false;
                this.sendBG({ cmd: "startProcess", settings: { isCollectedDone: false, isInProgress: true } }).then((settings:any) => {
                    this.settings.isInProgress = true;
                    this.manageTemplates();
                })
            }
        });
        this.$progressPanel.find("#cancel-progress").click(() => {
            this.settings.isInProgress = false;
            this.settings.isCollectedDone = true;
            this.sendBG({ cmd: "updateSettings", settings: { isCollectedDone: true, isInProgress: false } }).then((settings:any) => {
                this.settings = settings;
                this.manageTemplates();
            })

        });
        this.$downloadPanel.find("#cancel-download").click(() => {
            this.settings.isInProgress = false;
            this.settings.isCollectedDone = false; this.settings.connections = [];
            this.sendBG({ cmd: "updateSettings", settings: { isCollectedDone: false, connections: [], isInProgress: false } });
            this.manageTemplates();
        });
        let _this = this;
        this.$downloadPanel.find('#btn-download').click(function () {
            $(this).prop("disabled", true).html("Please wait...");
            setTimeout(() => _this.downloadCSV($(this)), 800)
        });
    },
    enclosedFields: function (desc:any) {
        var itemDesc
        if (desc) {
            itemDesc = desc.replace(/[^\\"]"/g, '\"')
            itemDesc = itemDesc.replace(/(\r\n|\n|\r|\s+|\t|&nbsp;)/gm, ' ')
            itemDesc = itemDesc.replace(/,/g, ',')
            itemDesc = itemDesc.replace(/"/g, "'")
            itemDesc = itemDesc.replace(/'/g, `'`)
            itemDesc = itemDesc.replace(/’/g, '’')
            itemDesc = itemDesc.replace(/ +(?= )/g, '')
        } else {
            itemDesc = ''
        }
        return itemDesc
    },
    downloadCSV(btn:any) {
        var csv_data = "linkedinFullName,firstName,lastName,fullName,publicIdentifier,uniqueProfileID,headline,profileUrl,profilePhoto,connectedOn,additionalNote\n";
        var nil = "NIL";
        for (let record of this.settings.connections) {

            let epochTime = record.connectedOn,
            userLocale = navigator.language,
            date = new Date(epochTime),
            options = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            formattedDate = date.toLocaleDateString(userLocale, options);            
            csv_data += '"' + this.enclosedFields(record.originalFullName) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.firstName) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.lastName) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.fullName) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.publicIdentifier) + '"';
            csv_data += ',';
            csv_data += '"' + record.uniqueProfileID + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.headline) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.profileUrl) + '"';
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.profilePhoto) + '"';
            csv_data += ',';
            csv_data += `${formattedDate}`;
            csv_data += ',';
            csv_data += '"' + this.enclosedFields(record.additionalNote) + '"';
            csv_data += '\r\n';
        }
        let fileName = "connections_" + (new Date()).toISOString().substring(0, 10) + "-" + (new Date()).toLocaleTimeString();
        let link = document.createElement("a");
        document.body.appendChild(link);
        link.download = fileName + ".csv"
        link.href = window.webkitURL.createObjectURL(new Blob([csv_data.replace(/,\s*$/, "")], { type: 'text/csv;charset=utf-8,%EF%BB%BF;' }));
        link.click()
        document.body.removeChild(link);

        setTimeout(() => (btn.prop("disabled", false).html("Download Connections"), this.$downloadPanel.find("#cancel-download").click()), 500)
    },
    manageTemplates() {
        this.$loginPanel.hide();
        this.$logoutPanel.hide();
        this.$homePanel.hide();
        this.$progressPanel.hide();
        this.$downloadPanel.hide();
        if (this.settings.hasLiAt) {
            this.$loginPanel.show();
            this.$logoutPanel.hide();
        } else {
            this.$loginPanel.hide();
            this.$logoutPanel.show();
            return;
        }
        $('#profilePic').attr("src", this.settings.loggedInUser.profilePicture + "&" + (+new Date()))
        if (this.settings.isInProgress) {
            this.$progressPanel.show();
            this.$progressPanel.find("#collecting-label").html(`Collecting ${this.settings.totalConnections} connections.`);
        } else {
            if (this.settings.isCollectedDone && this.settings.connections.length) {
                this.$downloadPanel.show();
                this.$downloadPanel.find("#collected-label").html(`${this.settings.totalConnections} connections collected.`);
            } else {
                this.$homePanel.show();
            }
        }
    },
    updateProgress(progress:any) {
        $('.progress-panel .progress-bar').css({ width: progress + "%" })
    }
}
$(() => Popup.init());
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    console.log(message)
    switch (message.cmd) {
        case 'updateUI': Popup.settings = message.settings; Popup.manageTemplates(); break;
        case 'updateProgress': Popup.updateProgress(message.progress);
    }
});
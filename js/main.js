/**
 *
 * @author Pawel Rojek <pawel at pawelrojek.com>
 * @author Ian Reinhart Geiser <igeiser at devonit.com>
 *
 * This file is licensed under the Affero General Public License version 3 or later.
 *
 **/

 (function (OCA) {

    OCA.DrawIO = _.extend({}, OCA.Drawio);

    OCA.AppSettings = null;
    OCA.DrawIO.Mimes = [];
    OCA.DrawIO.Urls = null;

    if (!OCA.DrawIO.AppName) {
        OCA.DrawIO = {
            AppName: "drawio"
        };
    }

    OCA.DrawIO.DisplayError = function (error) {
        $("#app")
        .text(error)
        .addClass("error");
    };

    OCA.DrawIO.Cleanup = function (receiver, filePath) {
        window.removeEventListener("message", receiver);

        var ncClient = OC.Files.getClient();
        ncClient.getFileInfo(filePath)
        .then(function (status, fileInfo) {
            var url = OC.generateUrl("/apps/files/?dir={currentDirectory}", {
                currentDirectory: fileInfo.path,
            });
            window.location.href = url;
        })
        .fail(function () {
            var url = OC.generateUrl("/apps/files");
            window.location.href = url;
        });
    };

    OCA.DrawIO.EditFile = function (editWindow, filePath, origin) {
        var ncClient = OC.Files.getClient();
        var receiver = function (evt) {
            if (evt.data.length > 0 && origin.includes(evt.origin)) {
                var payload = JSON.parse(evt.data);
                if (payload.event === "init") {
                    var loadMsg = OC.Notification.show(t(OCA.DrawIO.AppName, "Loading, please wait."));
                    ncClient.getFileContents(filePath)
                    .then(function (status, contents) {
                        if (contents === " ") {
                            editWindow.postMessage(JSON.stringify({
                                action: "template",
                                name: filePath
                            }), "*");
                        } else if (contents.indexOf("mxGraphModel") !== -1) {
                            // TODO: show error to user
                            OCA.DrawIO.Cleanup(receiver, filePath);
                        } else {
                            editWindow.postMessage(JSON.stringify({
                                action: "load",
                                xml: contents
                            }), "*");
                        }
                    })
                    .fail(function (status) {
                        console.log("Status Error: " + status);
                        // TODO: show error on failed read
                        OCA.DrawIO.Cleanup(receiver, filePath);
                    })
                    .done(function () {
                        OC.Notification.hide(loadMsg);
                    });
                } else if (payload.event === "load") {
                    // TODO: notify user of loaded
                } else if (payload.event === "export") {
                    // TODO: handle export event
                } else if (payload.event === "save") {
                    var saveMsg = OC.Notification.show(t(OCA.DrawIO.AppName, "Saving..."));
                    ncClient.putFileContents(
                        filePath,
                        payload.xml, {
                            contentType: "x-application/drawio",
                            overwrite: false
                        }
                    )
                    .then(function (status) {
                        OC.Notification.showTemporary(t(OCA.DrawIO.AppName, "File saved!"));
                    })
                    .fail(function (status) {
                        // TODO: handle on failed write
                        OC.Notification.showTemporary(t(OCA.DrawIO.AppName, "File not saved!"));
                    })
                    .done(function () {
                        OC.Notification.hide(saveMsg);
                    });
                } else if (payload.event === "exit") {
                    OCA.DrawIO.Cleanup(receiver, filePath);
                } else {
                    console.log("DrawIO Integration: unknown event " + payload.event);
                    console.dir(payload);
                }
            } else {
                console.log("DrawIO Integration: bad origin " + evt.origin);
            }
        }
        window.addEventListener("message", receiver);
    }


    OCA.DrawIO.EditFileNewWindow = function (filePath) {
	var iframeTemplate = `<iframe id="iframeEditor" width="100%" height="100%" align="top" frameborder="0" name="iframeEditor" onmousewheel="" allowfullscreen=""></iframe>`;

       $('#content').html(iframeTemplate);

	var iframe = $("#iframeEditor")[0];
	// append username to iframe src for user tracking.
	var drawioUrl = OCA.DrawIO.Urls.drawioUrl + "&username=" + OC.getCurrentUser().uid;
	var originUrl = OCA.DrawIO.Urls.originUrl
	
	OCA.DrawIO.EditFileWImport(iframe.contentWindow, filePath, originUrl);
	iframe.setAttribute('src', drawioUrl);
    }

    showDeprecatedVSD = function() {
   	OC.Notification.showHtml("VSD support is deprecated, please click <a href='https://cern.service-now.com/service-portal/article.do?n=KB0005932'>here</a> to obtain more information", {type: "error", timeout: 10}); 
    };

    OCA.DrawIO.FileList = {
        attach: function (fileList) {
            if (fileList.id == "trashbin") {
                return;
            }

            $.get(OC.generateUrl("apps/" + OCA.DrawIO.AppName + "/ajax/settings"))
            .done(function (json) {
                OCA.AppSettings = json.settings;
                OCA.DrawIO.Mimes = json.formats;
		OCA.DrawIO.Urls = json.urls;

                fileList.fileActions.setDefault("application/vsd", "showDeprecatedVSD");
                fileList.fileActions.registerAction({
                        name: "showDeprecatedVSD",
                        displayName: t(OCA.DrawIO.AppName, "Open in Draw.io"),
                                                        mime: "application/vsd",
                                                        permissions: OC.PERMISSION_READ | OC.PERMISSION_UPDATE,
                                                        icon: function () {
                                                            return OC.imagePath(OCA.DrawIO.AppName, "btn-edit");
                                                        },
                                                        iconClass: "icon-drawio-xml",
                                                        actionHandler: function (fileName, context) {
								showDeprecatedVSD();
                                                        }
                    });


                $.each(OCA.DrawIO.Mimes, function (ext, attr) {
                    fileList.fileActions.registerAction({
                        name: "drawioOpen",
                        displayName: t(OCA.DrawIO.AppName, "Open in Draw.io"),
                                                        mime: attr.mime,
                                                        permissions: OC.PERMISSION_READ | OC.PERMISSION_UPDATE,
                                                        icon: function () {
                                                            return OC.imagePath(OCA.DrawIO.AppName, "btn-edit");
                                                        },
                                                        iconClass: "icon-drawio-xml",
                                                        actionHandler: function (fileName, context) {
                                                            var dir = fileList.getCurrentDirectory();
                                                            OCA.DrawIO.EditFileNewWindow(OC.joinPaths(dir, fileName));
                                                        }
                    });

                    if ((fileList.fileActions.getDefaultFileAction(attr.mime, "file", OC.PERMISSION_READ) == false) || (OCA.AppSettings.overrideXml == "yes")) {
                        fileList.fileActions.setDefault(attr.mime, "drawioOpen");
                    } else if(attr.mime == "application/x-drawio") {
                        fileList.fileActions.setDefault(attr.mime, "drawioOpen");
                    }
                });
            })
            .fail(function () {
                //TODO: notify user of error
            });
        }
    };

    OCA.DrawIO.NewFileMenu = {
        attach: function (menu) {
            var fileList = menu.fileList;

            if (fileList.id !== "files") {
                return;
            }

            if(OCA.AppSettings.overrideXml == "yes") {
                menu.addMenuEntry({
                    id: "drawIoDiagram",
                    displayName: t(OCA.DrawIO.AppName, "Diagram"),
                                  templateName: t(OCA.DrawIO.AppName, "New Diagram.xml"),
                                  iconClass: "icon-drawio-new-xml", //fileType: "x-application/drawio",
                                  fileType: "xml",
                                  actionHandler: function (fileName) {
                                      var dir = fileList.getCurrentDirectory();
                                      fileList.createFile(fileName)
                                      .then(function () {
                                          OCA.DrawIO.EditFileNewWindow(OC.joinPaths(dir, fileName));
                                      });
                                  }
                });
            } else {
                menu.addMenuEntry({
                    id: "drawIoDiagram",
                    displayName: t(OCA.DrawIO.AppName, "Diagram"),
                                  templateName: t(OCA.DrawIO.AppName, "New Diagram.drawio"),
                                  iconClass: "icon-drawio-new-xml", //fileType: "x-application/drawio",
                                  fileType: "drawio",
                                  actionHandler: function (fileName) {
                                      var dir = fileList.getCurrentDirectory();
                                      fileList.createFile(fileName)
                                      .then(function () {
                                          OCA.DrawIO.EditFileNewWindow(OC.joinPaths(dir, fileName));
                                      });
                                  }
                });
            }
        }
    };

    
})(OCA);

OC.Plugins.register("OCA.Files.FileList", OCA.DrawIO.FileList);
OC.Plugins.register("OCA.Files.NewFileMenu", OCA.DrawIO.NewFileMenu);

/*
 * A little bit of a hack - changing file icon...
 */
$(document)
.ready(function () {

    PluginDrawIO_ChangeIcons = function () {
        $("#filestable")
        .find("tr[data-type=file]")
        .each(function () {
            if ((($(this)
                .attr("data-mime") == "text/xml; charset=utf-8") ||
                ($(this)
                .attr("data-mime") == "application/x-drawio") || 
                ($(this)
                .attr("data-mime") == "application/vsd")) && ($(this)
                .find("div.thumbnail")
                .length > 0)) {
                if ($(this)
                    .find("div.thumbnail")
                    .hasClass("icon-drawio-xml") == false) {
                    $(this)
                    .find("div.thumbnail")
                    .addClass("icon icon-drawio-xml");
                    }
                }
        });
    };

    PluginDrawIO_ChangeIconsNative = function () {
        $("#filestable")
        .find("tr[data-type=file]")
        .each(function () {
            if (($(this)
                .attr("data-mime") == "application/x-drawio") || 
		($(this)
                .attr("data-mime") == "application/vsd") && ($(this)
                .find("div.thumbnail")
                .length > 0)) {
                if ($(this)
                    .find("div.thumbnail")
                    .hasClass("icon-drawio-xml") == false) {
                    $(this)
                    .find("div.thumbnail")
                    .addClass("icon icon-drawio-xml");
                    }
                }
        });
    };

    if ($('#filesApp')
        .val()) {
        $('#app-content-files')
        .add('#app-content-extstoragemounts')
        .on('changeDirectory', function (e) {
            if (OCA.AppSettings == null) return;
            if (OCA.AppSettings.overrideXml == "yes") {
                PluginDrawIO_ChangeIcons();
            } else {
                PluginDrawIO_ChangeIconsNative();
            }
        })
        .on('fileActionsReady', function (e) {
            if (OCA.AppSettings == null) return;
            if (OCA.AppSettings.overrideXml == "yes") {
                PluginDrawIO_ChangeIcons();
            } else {
                PluginDrawIO_ChangeIconsNative();
            }
        });
        }
});

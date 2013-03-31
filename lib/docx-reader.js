exports.read = read;

var q = require("q");
var _ = require("underscore");
var ZipFile = require("zipfile").ZipFile;

var xmlreader = require("./xmlreader");
var documents = require("./documents");


function read(docxFile) {
    if (_.isString(docxFile)) {
        var zipFile = new ZipFile(docxFile);
        docxFile = {
            read: function(path) {
                return q.ninvoke(zipFile, "readFile", path, "utf-8")
                    .then(function(value) {
                        return value.toString();
                    });
            }
        };
    }
    
    return docxFile.read("word/document.xml")
        .then(xmlreader.read)
        .then(convertXmlToDocument);
}

function convertXmlToDocument(documentXml) {
    var body = documentXml.root.first("w:body");
    
    var children = readXmlElements(body.children);
    return new documents.Document(children);
}

function readXmlElements(elements) {
    return elements.map(readXmlElement).filter(notNull);
}

function readXmlElement(element) {
    if (element.type === "element") {
        var handler = xmlElementReaders[element.name];
        if (handler) {
            return handler(element);
        } else {
            return null;
        }
    } else {
        return null;
    }
}

var xmlElementReaders = {
    "w:p": function(element) {
        var children = readXmlElements(element.children);
        var properties;
        var propertiesElement = _.find(children, isParagraphProperties);
        if (propertiesElement) {
            properties = propertiesElement.properties;
        }
        
        return new documents.Paragraph(
            children.filter(negate(isParagraphProperties)),
            properties
        );
    },
    "w:pPr": function(element) {
        var properties = {
        };
        
        var styleElement = element.first("w:pStyle");
        if (styleElement) {
            properties.styleName = styleElement.attributes["w:val"];
        }
        
        return {
            type: "paragraphProperties",
            properties: properties
        };
    },
    "w:r": function(element) {
        var children = readXmlElements(element.children);
        return new documents.Run(children);
    },
    "w:t": function(element) {
        return new documents.Text(element.children[0].value);
    }
};

function parseXml(string) {
    return xmlreader.read(string);
}

function notNull(value) {
    return value !== null;
}

function isParagraphProperties(element) {
    return element.type === "paragraphProperties";
}

function negate(predicate) {
    return function(value) {
        return !predicate(value);
    };
}
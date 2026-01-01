import { Client } from "../lib/archipelago.min.js";
import { calculate_similarity, clear, image_invert_colors, reset_canvas_and_history, resize_canvas_without_saving_dimensions, select_tool, undo } from "./functions.js";
import { flip_horizontal, flip_vertical } from "./image-manipulation.js";

// Create a new instance of the Client class.
const client = new Client();
var slotData = {}

// Set up an event listener for whenever a message arrives and print the plain-text content to the console.
client.messages.on("message", (content) => {
	console.log(content);
});

var $ap_options_window = $Window({ title: "Archipelago Connection Options", minimizeButton: false, maximizeButton: false, closeButton: false })
	.addClass("maximized").addClass("focused").css({ left: 0, top: 0, width: "100vw", height: "100vh" });
$ap_options_window.$content.append('<p><label>Host: <input name="aphost" value="archipelago.gg"></label></p><p><label>Port: <input name="apport" placeholder="38281"></label></p><p><label>Slot name: <input name="apslot"></label></p><p><label>Password: <input name="appass"></label></p>');
$("<button>Connect!</button>").on("click", function () {
	client.login($("[name=aphost]").val() + ":" + $("[name=apport]").val(), $("[name=apslot]").val(), "Paint", { "password": $("[name=appass]").val(), })
		.then(function (e) {
			console.log("Connected to the Archipelago server!", e);
			slotData = e;
			if (slotData.version) $("#appaint-version").text("APWorld Version " + slotData.version);
			//$goal_image.src = "images/archipelago/" + slotData.goal_image + ".png";
			$G.triggerHandler("save-connection-info");
			$G.triggerHandler("restore-colors");
			update();
			select_tool(default_tool);
			if (slotData.death_link) {
				client.deathLink.enableDeathLink();
				client.deathLink.on("deathReceived", function () {
					reset_canvas_and_history();
					update();
				})
			}
			client.messages.on("message", onMessage);
			client.items.on("itemsReceived", onReceive);
			client.socket.on("disconnected", function () {
				client.messages.off("message", onMessage);
				client.items.off("itemsReceived", onReceive);
				$ap_options_window.show();
			})
			$ap_options_window.hide();
		})
		.catch(function (e) {
			console.error(e);
			alert(e);
		})
}).appendTo($ap_options_window.$content);

function send(similarity) {
	var locations = [];
	if (version_below("0.4.0")) {
		for (var i = 1; i <= similarity; i++) {
			locations.push(198500 + i);
		}
	}
	else {
		for (var i = 1; i <= similarity * 4; i++) {
			locations.push(198600 + i);
		}
	}
	client.check(...locations);
	if (similarity >= slotData.goal_percent) client.goal();
}

function received() {
	var items = [];
	for (var item of client.items.received) items.push(item.name);
	if (version_below("0.2.0")) {
		items.push("Magnifier");
		items.push("Brush");
	}
	return items;
}

function onReceive(items) {
	for (var item of items) {
		if (item.name.endsWith("Trap")) {
			switch (item.name) {
				case "Undo Trap":
					undo();
					break;
				case "Clear Image Trap":
					clear();
					break;
				case "Invert Colors Trap":
					image_invert_colors();
					break;
				case "Flip Horizontal Trap":
					flip_horizontal();
					break;
				case "Flip Vertical Trap":
					flip_vertical();
					break;
			}
		}
	}
	update();
}

function onMessage(message) {
	$("#text-log").append("<br>" + message);
}

function update() {
	var c = 2;
	var w = 400;
	var h = 300;
	for (var item of received()) {
		switch (item) {
			case "Additional Palette Color":
				c++;
				if (c > palette.length) palette.push("#FFFFFF");
				break;
			case "Free-Form Select":
			case "Select":
			case "Eraser/Color Eraser":
			case "Fill With Color":
			case "Pick Color":
			case "Magnifier":
			case "Pencil":
			case "Brush":
			case "Airbrush":
			case "Text":
			case "Line":
			case "Curve":
			case "Rectangle":
			case "Polygon":
			case "Ellipse":
			case "Rounded Rectangle":
				$('#TOOL_' + item.split("/")[0].split(" With")[0].replace(" ", "_").replace("-", "_").toUpperCase() + '').removeClass("disabled");
				break;
			case "Progressive Canvas Width":
				if (w < 800) w += slotData.canvas_size_increment ?? 100;
				break;
			case "Progressive Canvas Height":
				if (h < 600) h += slotData.canvas_size_increment ?? 100;
				break;
		}
	}
	default_tool = get_tool_by_id("TOOL_" +
		["Brush", "Pencil", "Eraser/Color Eraser", "Airbrush", "Line", "Rectangle", "Ellipse", "Rounded Rectangle"]
			.filter(a => received().includes(a))[0].split("/")[0].replace(" ", "_").toUpperCase());
	resize_canvas_without_saving_dimensions(w, h);
	$colorbox.rebuild_palette(palette);
	calculate_similarity();
}

function deathlink(method) {
	if (slotData.death_link) {
		switch (method) {
			case "undo":
				client.deathLink.sendDeathLink(client.name, client.name + " made a minor mistake.");
				break;
			case "clear":
				client.deathLink.sendDeathLink(client.name, client.name + " decided to start over.");
				break;
			default:
				client.deathLink.sendDeathLink(client.name);
				break;
		}
	}
}

/** @type {OSGUI$Window} */
let $text_client_window;

function show_text_client() {
	if ($text_client_window) {
		$text_client_window.close();
		$("#ap-command").off("keyup");
	}
	$text_client_window = $Window({ title: localize("Archipelago Text Client"), resizable: true, innerHeight: 300, innerWidth: 600 });
	$text_client_window.onClosed(function () { $("body").append($("#text-client").css("display", "none")); })
	$text_client_window.$content.append($("#text-client").css("display", "flex"));
	$text_client_window.center();
	$("#ap-command").on("keyup", function (e) {
		if (e.key == "Enter" && $("#ap-command").val().trim()) {
			client.messages.say($("#ap-command").val());
			$("#ap-command").val("");
		}
	});
}

function version_below(version) {
	if (!slotData.version) return true;
	var t = version.split(".");
	var v = slotData.version.split(".");
	if (parseInt(v[0]) > parseInt(t[0])) return false;
	if (parseInt(v[0]) < parseInt(t[0])) return true;
	if (parseInt(v[1]) > parseInt(t[1])) return false;
	if (parseInt(v[1]) < parseInt(t[1])) return true;
	if (parseInt(v[2]) > parseInt(t[2])) return false;
	if (parseInt(v[2]) < parseInt(t[2])) return true;
	return false;
}

export { deathlink, received, send, show_text_client, slotData, version_below };


extends Node

@onready var message_label = $MessageLabel
var websocket = WebSocketPeer.new()

func _ready():
	websocket.connect_to_url("ws://localhost:8080")

func _process(_delta):
	websocket.poll()
	
	if websocket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		while websocket.get_available_packet_count() > 0:
			var packet = websocket.get_packet()
			var message = JSON.parse_string(packet.get_string_from_utf8())
			if message:
				message_label.text = message.user + ": " + message.comment
	elif websocket.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		var code = websocket.get_close_code()
		var reason = websocket.get_close_reason()
		print("WebSocket fermé avec code: ", code, ", raison: ", reason)
		# Tentative de reconnexion
		websocket = WebSocketPeer.new()
		websocket.connect_to_url("ws://localhost:8080")

func _handle_message(data: Dictionary):
	if data.has("user") and data.has("comment"):
		print("Traitement du message de: ", data["user"])
		message_label.text = data["user"] + ": " + data["comment"]
		print("Message affiché dans le label") 

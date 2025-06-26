extends Node

@onready var message_label = $MessageLabel

var websocket_client: WebSocketPeer

func _ready():
	# Initialiser la connexion WebSocket
	websocket_client = WebSocketPeer.new()
	var error = websocket_client.connect_to_url("ws://localhost:8080")
	if error != OK:
		print("Erreur de connexion WebSocket: ", error)

func _process(_delta):
	
	if websocket_client.get_ready_state() == WebSocketPeer.STATE_OPEN:
		websocket_client.poll()
		# Lire les messages entrants
		while websocket_client.get_available_packet_count() > 0:
			var packet = websocket_client.get_packet()
			var message = JSON.parse_string(packet.get_string_from_utf8())
			_handle_message(message)

func _handle_message(data: Dictionary):
	if data.has("user") and data.has("comment"):
		message_label.text = data["user"] + ": " + data["comment"]

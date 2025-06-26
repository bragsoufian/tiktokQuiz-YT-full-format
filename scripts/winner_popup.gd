extends Control

@onready var profile_pic1 = $Panel/VBoxContainer/HBoxContainer/FirstPlace/ProfilePic1
@onready var username_label1 = $Panel/VBoxContainer/HBoxContainer/FirstPlace/UsernameLabel1
@onready var points_label1 = $Panel/VBoxContainer/HBoxContainer/FirstPlace/PointsLabel1

@onready var profile_pic2 = $Panel/VBoxContainer/HBoxContainer/SecondPlace/ProfilePic2
@onready var username_label2 = $Panel/VBoxContainer/HBoxContainer/SecondPlace/UsernameLabel2
@onready var points_label2 = $Panel/VBoxContainer/HBoxContainer/SecondPlace/PointsLabel2

@onready var profile_pic3 = $Panel/VBoxContainer/HBoxContainer/ThirdPlace/ProfilePic3
@onready var username_label3 = $Panel/VBoxContainer/HBoxContainer/ThirdPlace/UsernameLabel3
@onready var points_label3 = $Panel/VBoxContainer/HBoxContainer/ThirdPlace/PointsLabel3

var http_request1: HTTPRequest
var http_request2: HTTPRequest
var http_request3: HTTPRequest

func _ready():
	# Cacher la popup au démarrage
	hide()
	# S'assurer que la popup est toujours au-dessus
	z_index = 1000
	
	# Créer trois HTTPRequest pour gérer les trois images séparément
	http_request1 = HTTPRequest.new()
	http_request2 = HTTPRequest.new()
	http_request3 = HTTPRequest.new()
	
	add_child(http_request1)
	add_child(http_request2)
	add_child(http_request3)
	
	http_request1.request_completed.connect(_on_request_completed1)
	http_request2.request_completed.connect(_on_request_completed2)
	http_request3.request_completed.connect(_on_request_completed3)

func show_winner(player_data: Dictionary):
	# Afficher les informations du gagnant (1st place)
	username_label1.text = player_data.winner
	points_label1.text = "Points: " + str(int(player_data.points))
	
	# Charger l'image de profil du gagnant
	var headers = [
		"User-Agent: Godot/4.4.1",
		"Accept: image/webp,image/*"
	]
	
	var error = http_request1.request(player_data.profilePic, headers)
	if error != OK:
		print("Erreur lors de la requête HTTP: ", error)
		# Réessayer après un court délai
		await get_tree().create_timer(1.0).timeout
		error = http_request1.request(player_data.profilePic, headers)
		if error != OK:
			print("Échec de la deuxième tentative de requête HTTP")
	
	# Afficher les informations du 2nd et 3ème si disponibles
	if player_data.has("second_place"):
		username_label2.text = player_data.second_place.user
		points_label2.text = "Points: " + str(int(player_data.second_place.points))
		_load_profile_image(player_data.second_place.profilePic, http_request2)
	else:
		username_label2.text = "No 2nd Place"
		points_label2.text = "Points: 0"
	
	if player_data.has("third_place"):
		username_label3.text = player_data.third_place.user
		points_label3.text = "Points: " + str(int(player_data.third_place.points))
		_load_profile_image(player_data.third_place.profilePic, http_request3)
	else:
		username_label3.text = "No 3rd Place"
		points_label3.text = "Points: 0"
	
	# S'assurer que la popup est au-dessus de tout
	z_index = 1000
	# Afficher la popup
	show()

func _load_profile_image(url: String, request: HTTPRequest):
	var headers = [
		"User-Agent: Godot/4.4.1",
		"Accept: image/webp,image/*"
	]
	
	var error = request.request(url, headers)
	if error != OK:
		print("Erreur lors de la requête HTTP pour l'image secondaire: ", error)

func _on_request_completed1(result, _response_code, _headers, body):
	_handle_image_result(result, body, profile_pic1, "gagnant")

func _on_request_completed2(result, _response_code, _headers, body):
	_handle_image_result(result, body, profile_pic2, "2ème")

func _on_request_completed3(result, _response_code, _headers, body):
	_handle_image_result(result, body, profile_pic3, "3ème")

func _handle_image_result(result, body, target_texture_rect: TextureRect, position: String):
	if result != HTTPRequest.RESULT_SUCCESS:
		print("Erreur lors du téléchargement de l'image: ", result)
		return
	
	var image = Image.new()
	var error = image.load_webp_from_buffer(body)
	if error != OK:
		print("Erreur lors du chargement de l'image WebP: ", error)
		return
	
	var texture = ImageTexture.create_from_image(image)
	if target_texture_rect and texture:
		target_texture_rect.texture = texture
		print("✅ Image de profil du ", position, " chargée avec succès")

func _exit_tree():
	if http_request1:
		http_request1.queue_free()
	if http_request2:
		http_request2.queue_free()
	if http_request3:
		http_request3.queue_free() 

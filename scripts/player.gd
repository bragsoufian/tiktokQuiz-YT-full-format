extends Node2D

@onready var sprite = $Sprite2D
@onready var points_label = $Sprite2D/PointsLabel
@onready var flag_texture_rect = $Sprite2D/TextureRect
var profile_pic_url: String
var username: String
var points: int = 0
var current_level: int = 1
var base_z_index: int
var http_request: HTTPRequest
var is_initialized: bool = false
var current_texture: Texture2D = null
var is_image_loaded: bool = false
var image_load_attempts: int = 0
const MAX_LOAD_ATTEMPTS = 3

# Variables pour la gestion des flags
var is_waiting_for_next_question: bool = false
var can_answer: bool = false
var go_flag_texture: Texture2D
var wait_flag_texture: Texture2D
var plus1_flag_texture: Texture2D
var minus1_flag_texture: Texture2D
var flag_timer: Timer

# Variable statique pour gérer le z-index global
static var next_z_index: int = 1000

# Variable pour tracker si le joueur a été mis au premier plan
var is_in_foreground: bool = false
var foreground_z_index: int = 0

# Audio components
var correct_sound_player: AudioStreamPlayer
var wrong_sound_player: AudioStreamPlayer
var correct_sound: AudioStream
var wrong_sound: AudioStream

func _ready():
	print("🎮 Player initialisé")
	base_z_index = z_index
	# Créer le HTTPRequest une seule fois au démarrage
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_request_completed)
	is_initialized = true
	
	# Setup audio players
	_setup_audio()
	
	# Charger les textures de flag
	_load_flag_textures()
	
	# S'assurer que le sprite est visible
	if sprite:
		sprite.visible = true
		sprite.z_index = base_z_index + 100
		print("✅ Sprite initialisé et visible")
	else:
		print("❌ ERREUR: Sprite non trouvé!")

func initialize(data: Dictionary):
	print("🎮 Initialisation du joueur: ", data.user)
	username = data.user
	profile_pic_url = data.profilePic
	points = data.points
	current_level = int(float(data.currentLevel))
	
	# Réinitialiser les variables d'image pour forcer le rechargement
	is_image_loaded = false
	image_load_attempts = 0
	current_texture = null
	
	print("🖼️ URL de l'image de profil: ", profile_pic_url)
	
	# S'assurer que le sprite est visible avec le z-index approprié
	sprite.visible = true
	if is_in_foreground:
		# Si le joueur est en premier plan, maintenir son z-index élevé
		sprite.z_index = foreground_z_index
		z_index = foreground_z_index
		print("📊 Maintien du z-index élevé lors de l'initialisation - Joueur: ", z_index, " Sprite: ", sprite.z_index)
	else:
		# Sinon, utiliser le z-index original
		sprite.z_index = base_z_index + 100
		z_index = base_z_index
		print("📊 Z-index du joueur: ", z_index, " - Z-index du sprite: ", sprite.z_index)
	
	sprite.modulate = Color(1, 1, 1, 1)  # Assurer que le sprite est complètement opaque
	
	# Charger l'image de profil
	_load_profile_image()
	
	# Mettre à jour le label
	_update_label()
	
	# Définir le flag initial basé sur les données reçues
	if data.has("initialFlag"):
		if data.initialFlag == "go":
			set_flag_to_go()
			print("🏁 Flag initial mis en go pour: ", username)
		else:
			set_flag_to_wait()
			print("🏁 Flag initial mis en wait pour: ", username)
	else:
		# Par défaut, mettre en wait
		set_flag_to_wait()
		print("🏁 Flag initial par défaut (wait) pour: ", username)
	
	# Jouer l'animation de création
	play_player_creation_animation()

func _load_profile_image():
	print("🖼️ Début du chargement d'image pour ", username, " - URL: ", profile_pic_url)
	
	if not profile_pic_url:
		print("❌ Pas d'URL d'image pour ", username)
		_use_default_texture()
		return
		
	if not http_request:
		print("❌ HTTPRequest non disponible pour ", username)
		_use_default_texture()
		return
		
	if image_load_attempts >= MAX_LOAD_ATTEMPTS:
		print("❌ Nombre maximum de tentatives atteint pour ", username)
		_use_default_texture()
		return
		
	print("📸 Tentative de chargement ", image_load_attempts + 1, " pour ", username)
	image_load_attempts += 1
	
	# Check if it's a local image
	if profile_pic_url.begins_with("res://"):
		print("📸 Chargement d'une image locale: ", profile_pic_url)
		var texture = load(profile_pic_url)
		if texture:
			current_texture = texture
			sprite.texture = current_texture
			sprite.visible = true
			is_image_loaded = true
			_update_display()
			print("✅ Image locale chargée avec succès pour ", username)
		else:
			print("❌ Erreur: Impossible de charger l'image locale")
			_use_default_texture()
		return
	
	# If it's a remote image, use HTTP request
	var headers = [
		"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		"Accept: image/webp,image/*",
		"Accept-Language: en-US,en;q=0.9",
		"Referer: https://www.tiktok.com/"
	]
	
	print("🌐 Envoi de la requête HTTP pour ", username)
	var error = http_request.request(profile_pic_url, headers)
	if error != OK:
		print("❌ Erreur lors de la requête HTTP: ", error, " pour ", username)
		_use_default_texture()
		return
	
	print("✅ Requête HTTP envoyée avec succès pour ", username)

func _use_default_texture():
	if sprite:
		sprite.texture = load("res://assets/profile pic.png")
		sprite.visible = true
		is_image_loaded = true
		_update_display()
		print("Utilisation de la texture par défaut pour ", username)

func _on_request_completed(result, response_code, headers, body):
	print("📨 Réponse HTTP reçue pour ", username, " - Result: ", result, " Code: ", response_code)
	
	if result != HTTPRequest.RESULT_SUCCESS:
		print("❌ Erreur lors du téléchargement de l'image: ", result, " pour ", username)
		_use_default_texture()
		return
		
	if response_code != 200:
		print("❌ Erreur HTTP: ", response_code, " pour ", username)
		_use_default_texture()
		return
	
	var image = Image.new()
	var error = OK
	
	# Essayer de charger l'image en fonction du type de contenu
	var content_type = ""
	for header in headers:
		if header[0].to_lower() == "content-type":
			content_type = header[1].to_lower()
			break
	
	print("📸 Type de contenu détecté: ", content_type, " pour ", username)
	
	# Essayer tous les formats supportés
	error = image.load_webp_from_buffer(body)
	if error != OK:
		error = image.load_jpg_from_buffer(body)
		if error != OK:
			error = image.load_png_from_buffer(body)
	
	if error != OK:
		print("❌ Impossible de charger l'image dans aucun format supporté pour ", username)
		_use_default_texture()
		return
	
	var texture = ImageTexture.create_from_image(image)
	if sprite and texture:
		current_texture = texture
		sprite.texture = current_texture
		sprite.visible = true
		is_image_loaded = true
		_update_display()
		print("✅ Texture appliquée avec succès pour ", username)
	else:
		print("❌ Erreur: Impossible d'appliquer la texture pour ", username)
		_use_default_texture()

func update_player_data(data: Dictionary):
	print("🔄 Mise à jour des données du joueur: ", data.user)
	
	# Mettre à jour les points et le niveau
	points = data.points
	current_level = int(float(data.currentLevel))
	
	# Mettre à jour le label
	_update_label()
	
	# S'assurer que le sprite reste visible avec le bon z-index
	sprite.visible = true
	sprite.modulate = Color(1, 1, 1, 1)
	
	# Respecter le z-index élevé si le joueur est en premier plan
	if is_in_foreground:
		z_index = foreground_z_index
		sprite.z_index = foreground_z_index
		print("📊 Maintien du z-index élevé lors de la mise à jour - Joueur: ", z_index, " Sprite: ", sprite.z_index)
	
	print("✅ Données du joueur mises à jour: ", username, " - Points: ", points, " - Niveau: ", current_level)

func _update_display():
	if not sprite:
		print("❌ ERREUR: Sprite non trouvé dans _update_display")
		return
	
	# S'assurer que le sprite est visible
	sprite.visible = true
	sprite.modulate = Color(1, 1, 1, 1)  # S'assurer qu'il n'est pas transparent
	
	# Mettre à jour le label des points
	if points_label:
		points_label.text = str(points)
		print("Mise à jour des points pour ", username, " : ", points)
	else:
		print("❌ ERREUR: PointsLabel non trouvé")
	
	# S'assurer que la texture est toujours appliquée
	if current_texture and sprite.texture != current_texture:
		sprite.texture = current_texture
		print("✅ Texture appliquée dans _update_display pour ", username)

func _exit_tree():
	if http_request:
		http_request.queue_free()
		http_request = null
		is_initialized = false
		is_image_loaded = false 

func _update_label():
	if points_label:
		points_label.text = str(points)
		print("Mise à jour des points pour ", username, " : ", points)
	else:
		print("❌ ERREUR: PointsLabel non trouvé")

func _setup_audio():
	# Create correct answer sound player
	correct_sound_player = AudioStreamPlayer.new()
	add_child(correct_sound_player)
	correct_sound_player.name = "CorrectSoundPlayer"
	correct_sound_player.volume_db = -5.0
	correct_sound_player.bus = "Master"
	
	# Create wrong answer sound player
	wrong_sound_player = AudioStreamPlayer.new()
	add_child(wrong_sound_player)
	wrong_sound_player.name = "WrongSoundPlayer"
	wrong_sound_player.volume_db = -5.0
	wrong_sound_player.bus = "Master"
	
	print("🔊 Audio players créés pour ", username)
	print("📊 Correct sound player volume: ", correct_sound_player.volume_db, " dB")
	print("📊 Wrong sound player volume: ", wrong_sound_player.volume_db, " dB")
	print("📊 Master bus volume: ", AudioServer.get_bus_volume_db(AudioServer.get_bus_index("Master")), " dB")

func load_answer_sounds():
	"""Charge les sons de réponse depuis les assets"""
	# Load correct answer sound
	if ResourceLoader.exists("res://assets/sounds/good-answer.ogg"):
		correct_sound = load("res://assets/sounds/good-answer.ogg")
		if correct_sound_player:
			correct_sound_player.stream = correct_sound
			print("✅ Son de bonne réponse chargé pour ", username)
	else:
		print("❌ Fichier good-answer.ogg non trouvé")
	
	# Load wrong answer sound
	if ResourceLoader.exists("res://assets/sounds/bad_answer.mp3"):
		wrong_sound = load("res://assets/sounds/bad_answer.mp3")
		if wrong_sound_player:
			wrong_sound_player.stream = wrong_sound
			print("✅ Son de mauvaise réponse chargé pour ", username)
	else:
		print("❌ Fichier bad_answer.ogg non trouvé")

func _ensure_player_foreground():
	"""S'assure que le joueur est toujours au premier plan"""
	if not sprite:
		print("❌ Sprite non trouvé pour mettre au premier plan")
		return
	
	# Utiliser un z-index dynamique qui augmente à chaque animation
	next_z_index += 1
	var current_z = next_z_index
	
	# Sauvegarder le z-index élevé
	foreground_z_index = current_z
	is_in_foreground = true
	
	# Forcer le z-index élevé pour le joueur et le sprite
	z_index = current_z
	sprite.z_index = current_z
	
	# S'assurer que le sprite est visible et non transparent
	sprite.visible = true
	sprite.modulate = Color(1, 1, 1, 1)
	
	print("📊 Joueur mis au premier plan - Z-index Joueur: ", z_index, " Sprite: ", sprite.z_index, " (Z-index global: ", next_z_index, ")")

func play_correct_answer_animation():
	"""Joue l'animation de bonne réponse (vert brillant)"""
	if not sprite:
		print("❌ Sprite non trouvé pour l'animation de bonne réponse")
		return
	
	print("🎨 Début de l'animation de bonne réponse pour: ", username)
	
	# S'assurer que le joueur est au premier plan
	_ensure_player_foreground()
	
	# Play correct answer sound
	if correct_sound_player and correct_sound_player.stream:
		print("🔊 Tentative de lecture du son de bonne réponse pour ", username)
		print("📊 Stream assigné: ", correct_sound_player.stream != null)
		print("📊 Volume actuel: ", correct_sound_player.volume_db, " dB")
		correct_sound_player.play()
		if correct_sound_player.is_playing():
			print("✅ Son de bonne réponse joué avec succès pour ", username)
		else:
			print("❌ Échec de la lecture du son de bonne réponse pour ", username)
	else:
		print("❌ Lecteur audio ou stream manquant pour le son de bonne réponse")
	
	# Créer un Tween pour l'animation
	var tween = create_tween()
	tween.set_parallel(true)
	
	# Animation vers le vert brillant
	tween.tween_property(sprite, "modulate", Color(0, 1, 0, 1), 0.3)
	tween.tween_property(sprite, "scale", Vector2(1.2, 1.2), 0.3)
	
	# Attendre puis revenir à la normale
	await tween.finished
	
	var return_tween = create_tween()
	return_tween.set_parallel(true)
	return_tween.tween_property(sprite, "modulate", Color(1, 1, 1, 1), 0.5)
	return_tween.tween_property(sprite, "scale", Vector2(1, 1), 0.5)
	
	# Mettre le flag en plus1 après l'animation
	set_flag_to_plus1()
	
	print("✅ Animation de bonne réponse terminée pour: ", username)

func play_wrong_answer_animation():
	"""Joue l'animation de mauvaise réponse (rouge)"""
	if not sprite:
		print("❌ Sprite non trouvé pour l'animation de mauvaise réponse")
		return
	
	print("🎨 Début de l'animation de mauvaise réponse pour: ", username)
	
	# S'assurer que le joueur est au premier plan
	_ensure_player_foreground()
	
	# Play wrong answer sound
	if wrong_sound_player and wrong_sound_player.stream:
		print("🔊 Tentative de lecture du son de mauvaise réponse pour ", username)
		print("📊 Stream assigné: ", wrong_sound_player.stream != null)
		print("📊 Volume actuel: ", wrong_sound_player.volume_db, " dB")
		wrong_sound_player.play()
		if wrong_sound_player.is_playing():
			print("✅ Son de mauvaise réponse joué avec succès pour ", username)
		else:
			print("❌ Échec de la lecture du son de mauvaise réponse pour ", username)
	else:
		print("❌ Lecteur audio ou stream manquant pour le son de mauvaise réponse")
	
	# Créer un Tween pour l'animation
	var tween = create_tween()
	tween.set_parallel(true)
	
	# Animation vers le rouge
	tween.tween_property(sprite, "modulate", Color(1, 0, 0, 1), 0.2)
	tween.tween_property(sprite, "scale", Vector2(0.9, 0.9), 0.2)
	
	# Attendre puis revenir à la normale
	await tween.finished
	
	var return_tween = create_tween()
	return_tween.set_parallel(true)
	return_tween.tween_property(sprite, "modulate", Color(1, 1, 1, 1), 0.3)
	return_tween.tween_property(sprite, "scale", Vector2(1, 1), 0.3)
	
	# Mettre le flag en minus1 après l'animation
	set_flag_to_minus1()
	
	print("❌ Animation de mauvaise réponse terminée pour: ", username)

func is_player_in_foreground() -> bool:
	"""Retourne true si le joueur est actuellement en premier plan"""
	return is_in_foreground

func get_foreground_z_index() -> int:
	"""Retourne le z-index élevé du joueur s'il est en premier plan"""
	return foreground_z_index if is_in_foreground else z_index

func play_player_creation_animation():
	"""Joue l'animation de création du joueur (bleu brillant)"""
	if not sprite:
		print("❌ Sprite non trouvé pour l'animation de création")
		return
	
	print("🎨 Début de l'animation de création pour: ", username)
	
	# S'assurer que le joueur est au premier plan
	_ensure_player_foreground()
	
	# Créer un Tween pour l'animation
	var tween = create_tween()
	tween.set_parallel(true)
	
	# Animation vers le bleu brillant
	tween.tween_property(sprite, "modulate", Color(0, 0.5, 1, 1), 0.4)
	tween.tween_property(sprite, "scale", Vector2(1.3, 1.3), 0.4)
	
	# Attendre puis revenir à la normale
	await tween.finished
	
	var return_tween = create_tween()
	return_tween.set_parallel(true)
	return_tween.tween_property(sprite, "modulate", Color(1, 1, 1, 1), 0.6)
	return_tween.tween_property(sprite, "scale", Vector2(1, 1), 0.6)
	
	print("✅ Animation de création terminée pour: ", username)

func _load_flag_textures():
	"""Charge les textures de flag depuis les assets"""
	go_flag_texture = load("res://assets/flags/go.png")
	wait_flag_texture = load("res://assets/flags/wait.png")
	plus1_flag_texture = load("res://assets/flags/plus1.png")
	minus1_flag_texture = load("res://assets/flags/minus1.png")
	
	if go_flag_texture:
		print("✅ Texture de flag go chargée")
	else:
		print("❌ Erreur: Impossible de charger go.png")
	
	if wait_flag_texture:
		print("✅ Texture de flag wait chargée")
	else:
		print("❌ Erreur: Impossible de charger wait.png")
	
	if plus1_flag_texture:
		print("✅ Texture de flag plus1 chargée")
	else:
		print("❌ Erreur: Impossible de charger plus1.png")
	
	if minus1_flag_texture:
		print("✅ Texture de flag minus1 chargée")
	else:
		print("❌ Erreur: Impossible de charger minus1.png")
	
	# Créer le timer pour les flags plus1/minus1
	flag_timer = Timer.new()
	flag_timer.wait_time = 3.0  # 3 secondes
	flag_timer.one_shot = true
	flag_timer.timeout.connect(_on_flag_timer_timeout)
	add_child(flag_timer)
	
	# Appliquer la texture wait par défaut
	set_flag_to_wait()

func set_flag_to_wait():
	"""Met le flag en état wait (pas de réponse autorisée)"""
	if flag_texture_rect and wait_flag_texture:
		flag_texture_rect.texture = wait_flag_texture
		can_answer = false
		print("🏁 Flag mis en wait pour: ", username)

func set_flag_to_go():
	"""Met le flag en état go (réponse autorisée)"""
	if flag_texture_rect and go_flag_texture:
		flag_texture_rect.texture = go_flag_texture
		can_answer = true
		print("🏁 Flag mis en go pour: ", username)

func set_flag_to_plus1():
	"""Met le flag en état plus1 (bonne réponse)"""
	if flag_texture_rect and plus1_flag_texture:
		flag_texture_rect.texture = plus1_flag_texture
		can_answer = false
		print("🏁 Flag mis en plus1 pour: ", username)
		
		# Démarrer le timer pour revenir à wait après 3 secondes
		if flag_timer:
			flag_timer.start()

func set_flag_to_minus1():
	"""Met le flag en état minus1 (mauvaise réponse)"""
	if flag_texture_rect and minus1_flag_texture:
		flag_texture_rect.texture = minus1_flag_texture
		can_answer = false
		print("🏁 Flag mis en minus1 pour: ", username)
		
		# Démarrer le timer pour revenir à wait après 3 secondes
		if flag_timer:
			flag_timer.start()

func reset_for_new_question():
	"""Remet le flag à wait pour une nouvelle question"""
	set_flag_to_wait()

func _on_flag_timer_timeout():
	"""Gère le timeout du timer pour les flags plus1/minus1"""
	print("🕒 Timeout du timer pour les flags plus1/minus1 pour: ", username)
	
	# Remettre le flag à wait
	set_flag_to_wait()

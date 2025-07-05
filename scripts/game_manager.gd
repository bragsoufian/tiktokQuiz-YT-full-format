extends Node

# Références aux scènes
@onready var grid = $Grid
@onready var levels = $Grid.get_children()

# WebSocket
var ws_client = WebSocketPeer.new()

# Données des joueurs
var players = {}

# Scène du joueur
var player_scene = load("res://scenes/player.tscn")

# Scène de la popup de victoire
var winner_popup_scene = preload("res://scenes/winner_popup.tscn")

# Interface des questions
var question_ui: Control

# Background image handling
var background_texture_rect: TextureRect
var background_http_request: HTTPRequest

# Audio pour l'écran Ready
var ready_sound_player: AudioStreamPlayer
var ready_sound: AudioStream

# Audio pour la musique de fond
var background_music_player: AudioStreamPlayer
var background_music: AudioStream

# Audio pour les sons de nouveaux joueurs
var new_player_sound_player: AudioStreamPlayer

# État du match
var match_ended = false
var winner = null

const LEVEL_SIZE = Vector2(250, 250)  # Taille fixe pour les niveaux

func _ready():
	print("🎮 GameManager initialisé")
	print("📊 Configuration de la grille avec 6 niveaux")
	
	# Vérifier que la grille et les niveaux existent
	if not grid:
		print("❌ ERREUR: Grid non trouvé!")
		return
		
	for i in range(1, 7):
		var level = grid.get_node("Level" + str(i))
		if level:
			print("✅ Niveau ", i, " trouvé")
		else:
			print("❌ ERREUR: Level", i, " non trouvé!")
	
	# Attendre un frame pour s'assurer que tous les nœuds sont prêts
	await get_tree().process_frame
	
	# Récupérer la référence à QuestionUI
	question_ui = get_parent().get_node_or_null("QuestionUI")
	if not question_ui:
		# Essayer de chercher dans toute la scène
		question_ui = get_tree().get_first_node_in_group("question_ui")
	if not question_ui:
		# Dernière tentative : chercher par nom dans la scène
		question_ui = get_tree().get_nodes_in_group("question_ui").front() if get_tree().get_nodes_in_group("question_ui").size() > 0 else null
	
	if question_ui:
		print("✅ QuestionUI trouvé")
		# Charger le son du timer
		question_ui.load_timer_sound("res://assets/sounds/timer_sound.ogg")
	else:
		print("⚠️ QuestionUI non trouvé - les questions ne s'afficheront pas")
	
	# Récupérer la référence au TextureRect de fond
	background_texture_rect = get_parent().get_node_or_null("BackgroundTextureRect")
	if background_texture_rect:
		print("✅ Background TextureRect trouvé")
		# Créer le HTTPRequest pour charger les images de fond
		background_http_request = HTTPRequest.new()
		add_child(background_http_request)
		background_http_request.request_completed.connect(_on_background_image_request_completed)
	else:
		print("❌ Background TextureRect non trouvé!")
	
	# Connexion WebSocket
	print("🌐 Tentative de connexion au serveur WebSocket...")
	var error = ws_client.connect_to_url("ws://localhost:8080")
	if error != OK:
		print("❌ Erreur de connexion WebSocket: ", error)
		return
	
	# Configuration de l'audio pour l'écran Ready
	_setup_ready_audio()
	
	# Configuration de la musique de fond
	_setup_background_music()
	
	# Configuration des sons de nouveaux joueurs
	_setup_new_player_sounds()
	
	# Test de la musique après un délai
	await get_tree().create_timer(1.0).timeout
	test_background_music()
	
	# Hide WinnerPopup at start (will be shown when announcing winner)
	hide_winner_popup()
	
	print("✅ GameManager prêt!")

func _process(_delta):
	if match_ended:
		return
		
	ws_client.poll()
	
	match ws_client.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			while ws_client.get_available_packet_count() > 0:
				var packet = ws_client.get_packet()
				var message = JSON.parse_string(packet.get_string_from_utf8())
				print("📨 Message reçu: ", message)
				
				_handle_websocket_message(message)
		
		WebSocketPeer.STATE_CLOSING:
			print("⚠️ Fermeture de la connexion WebSocket...")
		
		WebSocketPeer.STATE_CLOSED:
			var code = ws_client.get_close_code()
			var reason = ws_client.get_close_reason()
			print("❌ Connexion WebSocket fermée. Code: ", code, " Raison: ", reason)

func _handle_websocket_message(message: Dictionary):
	var message_type = message.get("type", "")
	
	match message_type:
		"match_started":
			_handle_match_started()
		"new_player":
			_handle_new_player(message)
		"player_update":
			_handle_player_update(message)
		"player_removed":
			_handle_player_remove(message)
		"new_question":
			_handle_new_question(message)
		"question_active":
			_handle_question_active()
		"start_timer":
			_handle_start_timer(message)
		"timer_ended":
			_handle_timer_ended()
		"question_ended":
			_handle_question_ended(message)
		"correct_answer":
			_handle_correct_answer(message)
		"wrong_answer":
			_handle_wrong_answer(message)
		"match_ended":
			_handle_match_ended(message)
		"show_ready":
			_handle_show_ready(message)
		"play_new_player_sound":
			_handle_play_new_player_sound(message)
		_:
			print("❓ Message inconnu reçu: ", message_type)

func _handle_new_player(data: Dictionary):
	if match_ended:
		return
		
	# Vérifier que toutes les données nécessaires sont présentes
	if not data.has_all(["user", "profilePic", "points", "currentLevel"]):
		print("❌ Données invalides pour la création du joueur")
		return
		
	print("👤 Nouveau joueur détecté: ", data.user)
	_create_player(data)

func _handle_player_update(data: Dictionary):
	if match_ended:
		return
		
	# Vérifier que toutes les données nécessaires sont présentes
	if not data.has_all(["user", "points", "currentLevel"]):
		print("❌ Données invalides pour la mise à jour du joueur")
		return
		
	print("👤 Mise à jour du joueur: ", data.user)
	if not players.has(data.user):
		print("❌ Joueur non trouvé pour la mise à jour: ", data.user)
		return
		
	print("🔄 Mise à jour des données du joueur existant")
	_update_player(data)

func _create_player(data: Dictionary):
	if match_ended:
		return
		
	# Vérifier que toutes les données nécessaires sont présentes
	if not data.has_all(["user", "profilePic", "points", "currentLevel"]):
		print("❌ Données invalides pour la création du joueur")
		return
		
	print("🎯 Création du joueur: ", data.user)
	var player = player_scene.instantiate()
	players[data.user] = player
	
	var level_number = int(float(data.currentLevel))  # Convert float to int
	var level_node = grid.get_node("Level" + str(level_number))
	if level_node:
		print("📍 Ajout du joueur au niveau ", level_number)
		level_node.add_child(player)
		print("✅ Joueur ajouté au niveau. Nombre d'enfants du niveau: ", level_node.get_child_count())
		
		# Obtenir la taille réelle du niveau
		var level_size = level_node.get_node("rectangle").shape.size
		# Positionner le joueur aléatoirement dans le niveau avec une marge
		var margin = 50  # Marge pour éviter que le joueur soit trop près des bords
		player.position = Vector2(
			randf_range(margin, level_size.x - margin),
			randf_range(margin, level_size.y - margin)
		)
		# Ne pas forcer le z-index ici, laisser le joueur s'initialiser avec ses propres valeurs
		print("📍 Position du joueur définie à: ", player.position)
		
		# Initialiser le joueur après l'avoir ajouté à l'arbre
		player.initialize(data)
		
		# Charger les sons de réponse
		player.load_answer_sounds()
	else:
		print("❌ Niveau non trouvé: Level", level_number)

func _show_winner_popup(player_data: Dictionary):
	print("🏆 Affichage de la popup de victoire avec les données: ", player_data)
	
	if not player_data.has("winner"):
		print("❌ Données de gagnant invalides")
		return
	
	# Récupérer la référence au WinnerPopup existant dans la scène Main
	var winner_popup = get_parent().get_node_or_null("WinnerPopup")
	if not winner_popup:
		print("❌ WinnerPopup non trouvé dans la scène Main!")
		return
	
	# Cacher tous les joueurs pour éviter qu'ils apparaissent au-dessus de la popup
	for player in players.values():
		if is_instance_valid(player):
			player.visible = false
			print("👤 Joueur caché: ", player.username)
	
	# Cacher l'interface des questions si elle existe
	if question_ui:
		question_ui.hide_question()
		print("❓ QuestionUI caché")
	
	# Créer un dictionnaire avec les données nécessaires pour la popup
	var winner_data = {
		"winner": player_data.winner,
		"points": player_data.points if player_data.has("points") else 0,
		"profilePic": player_data.profilePic if player_data.has("profilePic") else "",
		"second_place": player_data.second_place if player_data.has("second_place") else null,
		"third_place": player_data.third_place if player_data.has("third_place") else null
	}
	
	print("🏆 Données préparées pour la popup: ", winner_data)
	
	# Récupérer l'URL de la photo de profil du joueur gagnant
	if players.has(player_data.winner):
		var winner_player = players[player_data.winner]
		winner_data["profilePic"] = winner_player.profile_pic_url
		print("✅ URL de la photo de profil récupérée pour le gagnant")
	else:
		print("⚠️ Joueur gagnant non trouvé dans la liste des joueurs")
	
	# Trier les joueurs par points pour obtenir le top 3
	var sorted_players = []
	for username in players:
		var player = players[username]
		if is_instance_valid(player):
			sorted_players.append({
				"user": username,
				"points": player.points,
				"profilePic": player.profile_pic_url
			})
	
	# Trier par points (ordre décroissant)
	sorted_players.sort_custom(func(a, b): return a.points > b.points)
	
	# Ajouter les données du 2ème et 3ème si disponibles
	if sorted_players.size() > 1:
		winner_data["second_place"] = sorted_players[1]
	if sorted_players.size() > 2:
		winner_data["third_place"] = sorted_players[2]
	
	print("🏆 Appel de show_winner sur le WinnerPopup existant...")
	winner_popup.show_winner(winner_data)
	print("✅ show_winner appelé avec succès sur le WinnerPopup existant")
	
	# S'assurer que la popup est visible
	winner_popup.show()
	
	# Marquer le match comme terminé
	match_ended = true
	winner = player_data.winner
	print("🏆 Match terminé! Vainqueur: ", winner)
	
	# Redémarrer le jeu après 10 secondes
	await get_tree().create_timer(10.0).timeout
	_restart_game()

func _restart_game():
	print("🔄 Redémarrage du jeu...")
	
	# Fermer la connexion WebSocket existante
	if ws_client.get_ready_state() == WebSocketPeer.STATE_OPEN:
		print("🌐 Fermeture de la connexion WebSocket existante...")
		ws_client.close()
		await get_tree().create_timer(0.5).timeout  # Attendre que la connexion se ferme
	
	# Supprimer tous les joueurs existants
	for player in players.values():
		if is_instance_valid(player):
			player.queue_free()
	players.clear()
	
	# Réinitialiser l'état du jeu
	match_ended = false
	winner = null
	
	# Cacher la popup de victoire existante
	var winner_popup = get_parent().get_node_or_null("WinnerPopup")
	if winner_popup:
		winner_popup.hide()
		print("🏆 WinnerPopup existant caché")
	
	print("✅ Jeu réinitialisé")
	
	# Établir une nouvelle connexion WebSocket
	print("🌐 Établissement d'une nouvelle connexion WebSocket...")
	var error = ws_client.connect_to_url("ws://localhost:8080")
	if error != OK:
		print("❌ Erreur de connexion WebSocket: ", error)
		return
	print("✅ Nouvelle connexion WebSocket établie")

func _update_player(data: Dictionary):
	# Vérifier que toutes les données nécessaires sont présentes
	if not data.has_all(["user", "points", "currentLevel"]):
		print("❌ Données invalides pour la mise à jour du joueur")
		return
		
	if not players.has(data.user):
		print("❌ Joueur non trouvé pour la mise à jour: ", data.user)
		return
		
	var player = players[data.user]
	if not is_instance_valid(player):
		print("❌ Instance de joueur invalide pour: ", data.user)
		return
		
	print("🔄 Mise à jour du joueur ", data.user, " - Points: ", data.points, " - Niveau: ", data.currentLevel)
	
	# Mettre à jour les données du joueur
	player.update_player_data(data)
	
	# Mettre à jour la position en fonction du niveau
	var level_number = int(float(data.currentLevel))  # Convert float to int
	var level_node = grid.get_node_or_null("Level" + str(level_number))
	if level_node:
		# Retirer le joueur de son niveau actuel
		if player.get_parent():
			player.get_parent().remove_child(player)
		
		# Ajouter le joueur au nouveau niveau
		level_node.add_child(player)
		
		# Respecter le z-index élevé si le joueur est en premier plan
		if player.has_method("is_player_in_foreground") and player.is_player_in_foreground():
			var foreground_z = player.get_foreground_z_index()
			player.z_index = foreground_z
			print("📊 Maintien du z-index élevé lors du déplacement - Joueur: ", player.z_index)
		else:
			player.z_index = 100  # Ensure player is above everything
		
		# S'assurer que le sprite reste visible après la mise à jour
		if player.has_node("Sprite2D"):
			var sprite = player.get_node("Sprite2D")
			sprite.visible = true
			sprite.modulate = Color(1, 1, 1, 1)
			
			# Respecter le z-index élevé du sprite si le joueur est en premier plan
			if player.has_method("is_player_in_foreground") and player.is_player_in_foreground():
				var foreground_z = player.get_foreground_z_index()
				sprite.z_index = foreground_z
				print("📊 Maintien du z-index élevé du sprite lors du déplacement - Sprite: ", sprite.z_index)
			else:
				sprite.z_index = 100
			
			print("🔍 Forçage de la visibilité du sprite pour ", data.user)
		
		# Obtenir la taille réelle du niveau
		var level_size = level_node.get_node("rectangle").shape.size
		# Positionner le joueur aléatoirement dans le niveau avec une marge
		var margin = 50  # Marge pour éviter que le joueur soit trop près des bords
		player.position = Vector2(
			randf_range(margin, level_size.x - margin),
			randf_range(margin, level_size.y - margin)
		)
		print("✅ Joueur déplacé au niveau ", level_number)
		print("🔍 État final du joueur - Visible: ", player.visible, " Z-index: ", player.z_index)
	else:
		print("❌ Niveau non trouvé: Level", level_number)

func _handle_player_remove(data: Dictionary):
	if match_ended:
		return
		
	print("🗑️ Suppression du joueur: ", data.user)
	if players.has(data.user):
		var player = players[data.user]
		player.queue_free()
		players.erase(data.user)
		print("✅ Joueur supprimé avec succès")

func _move_player_to_level(username: String, new_level: int):
	var player = players[username]
	var current_parent = player.get_parent()
	
	# Retirer le joueur de son niveau actuel
	current_parent.remove_child(player)
	
	# Ajouter le joueur au nouveau niveau
	levels[new_level - 1].add_child(player)
	
	# Réinitialiser la position du joueur dans le nouveau niveau
	player.position = Vector2.ZERO 

func _handle_new_question(message: Dictionary):
	# Remettre tous les flags des joueurs à l'état standard
	for player in players.values():
		if is_instance_valid(player) and player.has_method("reset_for_new_question"):
			player.reset_for_new_question()
			print("🏁 Flag remis à standard pour: ", player.username)
	
	# Charger l'image de fond si disponible
	if message.has("backgroundImage") and not message.backgroundImage.is_empty():
		load_background_image(message.backgroundImage)
		print("🖼️ Image de fond demandée pour la question")
	
	if question_ui:
		question_ui.show_question(message)
	else:
		print("❌ QuestionUI non trouvé!")

func _handle_question_ended(message: Dictionary):
	if question_ui:
		# Set the correct answer first
		question_ui.set_correct_answer(message.correctAnswer)
		# Then show it
		question_ui.show_correct_answer()
	else:
		print("❌ QuestionUI non trouvé!")

func _handle_match_started():
	print("🎮 Début de match")
	
	# Cacher l'interface des questions
	if question_ui:
		question_ui.hide_question()

func _handle_correct_answer(message: Dictionary):
	if not players.has(message.user):
		print("❌ Joueur non trouvé pour l'animation de bonne réponse: ", message.user)
		return
	
	var player = players[message.user]
	if is_instance_valid(player):
		player.play_correct_answer_animation()
		print("✅ Animation de bonne réponse déclenchée pour: ", message.user)
	else:
		print("❌ Instance de joueur invalide pour l'animation: ", message.user)

func _handle_wrong_answer(message: Dictionary):
	if not players.has(message.user):
		print("❌ Joueur non trouvé pour l'animation de mauvaise réponse: ", message.user)
		return
	
	var player = players[message.user]
	if is_instance_valid(player):
		player.play_wrong_answer_animation()
		print("❌ Animation de mauvaise réponse déclenchée pour: ", message.user)
	else:
		print("❌ Instance de joueur invalide pour l'animation: ", message.user)

func _handle_match_ended(message: Dictionary):
	print("🏆 Message match_ended reçu: ", message)
	
	if not message.has("winner"):
		print("❌ Données de fin de match invalides - pas de winner")
		return
		
	print("✅ Données de fin de match valides, affichage de la popup...")
	_show_winner_popup(message)

func _handle_show_ready(message: Dictionary):
	print("🏁 Affichage de l'écran Ready")
	
	# Cacher l'interface des questions
	if question_ui:
		question_ui.hide_question()
	
	# Utiliser le nœud ReadyScreen existant dans la scène
	var ready_screen = get_parent().get_node_or_null("ReadyScreen")
	if not ready_screen:
		print("❌ ReadyScreen non trouvé dans la scène")
		return
	
	# Afficher l'écran Ready
	ready_screen.visible = true
	
	# Animation d'apparition
	var tween = create_tween()
	tween.tween_property(ready_screen, "modulate:a", 1.0, 0.5)
	
	# Jouer le son Ready
	if ready_sound_player and ready_sound_player.stream:
		ready_sound_player.play()
		print("🔊 Son Ready joué")
	else:
		print("❌ Lecteur audio Ready manquant ou stream non chargé")
	
	# Attendre 4 secondes avant de cacher l'écran
	await get_tree().create_timer(4.0).timeout
	
	# Cacher l'écran avec une animation
	var hide_tween = create_tween()
	hide_tween.tween_property(ready_screen, "modulate:a", 0.0, 0.5)
	await hide_tween.finished
	
	ready_screen.visible = false
	print("🏁 Écran Ready fermé (audio peut continuer)")

func _setup_ready_audio():
	# Configuration de l'audio pour l'écran Ready
	ready_sound_player = AudioStreamPlayer.new()
	ready_sound = preload("res://assets/sounds/ready_goo.ogg")
	ready_sound_player.stream = ready_sound
	ready_sound_player.volume_db = -10
	ready_sound_player.bus = "Master"
	add_child(ready_sound_player)

func _setup_background_music():
	# Configuration de la musique de fond
	background_music_player = AudioStreamPlayer.new()
	background_music = preload("res://assets/sounds/Who Wants to Be a Mill.ogg")
	background_music_player.stream = background_music
	background_music_player.volume_db = -10  # Volume plus bas que les effets sonores
	background_music_player.bus = "Master"
	background_music_player.autoplay = true  # Démarrer automatiquement
	add_child(background_music_player)
	print("🎵 Musique de fond configurée et démarrée automatiquement")
	print("🎵 Who Wants to Be a Mill.ogg - EN COURS DE LECTURE EN BOUCLE")
	
	# Debug: Vérifier l'état de la musique
	print("🔍 DEBUG - Stream chargé: ", background_music != null)
	print("🔍 DEBUG - Volume: ", background_music_player.volume_db, " dB")
	print("🔍 DEBUG - Bus: ", background_music_player.bus)
	print("🔍 DEBUG - Playing: ", background_music_player.playing)
	print("🔍 DEBUG - Autoplay: ", background_music_player.autoplay)

func start_background_music():
	# Démarrer la musique de fond en boucle
	if background_music_player and background_music_player.stream:
		background_music_player.play()
		print("🎵 Musique de fond démarrée")
	else:
		print("❌ Lecteur de musique de fond manquant ou stream non chargé")

func stop_background_music():
	# Arrêter la musique de fond
	if background_music_player:
		background_music_player.stop()
		print("🎵 Musique de fond arrêtée")

func test_background_music():
	# Fonction de test pour forcer le démarrage de la musique
	print("🧪 TEST - Tentative de démarrage forcé de la musique")
	if background_music_player:
		background_music_player.volume_db = 0  # Volume maximum pour test
		background_music_player.play()
		print("🧪 TEST - Musique forcée à jouer avec volume max")
		print("🧪 TEST - Playing: ", background_music_player.playing)
		print("🧪 TEST - Volume: ", background_music_player.volume_db, " dB")
	else:
		print("❌ TEST - Lecteur de musique non trouvé")

func _setup_new_player_sounds():
	# Configuration des sons de nouveaux joueurs
	new_player_sound_player = AudioStreamPlayer.new()
	new_player_sound_player.volume_db = -5  # Volume modéré
	new_player_sound_player.bus = "Master"
	add_child(new_player_sound_player)
	print("🔊 Lecteur de sons de nouveaux joueurs configuré")

func _handle_play_new_player_sound(message: Dictionary):
	# Jouer un son de nouveau joueur
	if message.has("sound_file") and new_player_sound_player:
		var sound_file = message.sound_file
		print("🔊 Jouer son de nouveau joueur: ", sound_file)
		
		# Charger et jouer le son
		var sound = load(sound_file)
		if sound:
			new_player_sound_player.stream = sound
			new_player_sound_player.play()
			print("✅ Son de nouveau joueur joué")
		else:
			print("❌ Impossible de charger le son: ", sound_file)
	else:
		print("❌ Données de son manquantes ou lecteur non configuré")

func _handle_start_timer(message: Dictionary):
	# Mettre tous les flags des joueurs en "go" (réponse autorisée) quand le timer démarre
	for player in players.values():
		if is_instance_valid(player) and player.has_method("set_flag_to_go"):
			player.set_flag_to_go()
			print("🏁 Flag mis en go pour: ", player.username)
	
	if question_ui:
		var timer_duration = message.get("timer", 5.0)  # Default to 5 seconds if not specified
		question_ui.start_timer(timer_duration)
		print("⏱️ Timer démarré avec ", timer_duration, " secondes")
	else:
		print("❌ QuestionUI non trouvé!")

func _handle_question_active():
	# Ne pas mettre les flags en go ici - cela sera fait quand le timer démarre
	print("🎯 Question active - les flags restent en wait jusqu'au démarrage du timer")

func _handle_timer_ended():
	# Mettre tous les flags des joueurs en "wait" (réponse non autorisée) quand le timer se termine
	for player in players.values():
		if is_instance_valid(player) and player.has_method("set_flag_to_wait"):
			player.set_flag_to_wait()
			print("🏁 Flag mis en wait pour: ", player.username)

func _on_background_image_request_completed(result, response_code, headers, body):
	print("🖼️ Background image request completed - Result: ", result, " Response code: ", response_code)
	
	if result != HTTPRequest.RESULT_SUCCESS:
		print("❌ Erreur lors de la récupération de l'image de fond")
		return
	
	if response_code != 200:
		print("❌ Erreur lors de la récupération de l'image de fond. Code de réponse: ", response_code)
		return
	
	print("🖼️ Image data received, size: ", body.size(), " bytes")
	
	var image = Image.new()
	var error = image.load_png_from_buffer(body)
	if error != OK:
		print("🖼️ PNG loading failed, trying JPEG...")
		# Essayer avec JPEG si PNG échoue
		error = image.load_jpg_from_buffer(body)
		if error != OK:
			print("❌ Impossible de charger l'image de fond (PNG et JPEG)")
			return
	
	print("🖼️ Image loaded successfully, size: ", image.get_width(), "x", image.get_height())
	
	var texture = ImageTexture.create_from_image(image)
	
	if background_texture_rect:
		print("🖼️ BackgroundTextureRect found, applying texture...")
		print("🖼️ BackgroundTextureRect visible: ", background_texture_rect.visible)
		print("🖼️ BackgroundTextureRect modulate: ", background_texture_rect.modulate)
		print("🖼️ BackgroundTextureRect z_index: ", background_texture_rect.z_index)
		
		# Store the old texture for comparison
		var old_texture = background_texture_rect.texture
		print("🖼️ Old texture: ", old_texture != null)
		
		# Apply the new texture
		background_texture_rect.texture = texture
		
		# Verify the texture was applied
		print("🖼️ New texture applied: ", background_texture_rect.texture != null)
		print("🖼️ New texture size: ", background_texture_rect.texture.get_width() if background_texture_rect.texture else "null", "x", background_texture_rect.texture.get_height() if background_texture_rect.texture else "null")
		
		# Force a redraw
		background_texture_rect.queue_redraw()
		
		print("✅ Image de fond appliquée au BackgroundTextureRect")
		print("🖼️ BackgroundTextureRect texture set: ", background_texture_rect.texture != null)
	else:
		print("❌ BackgroundTextureRect non trouvé!")

func load_background_image(image_url: String):
	print("🖼️ load_background_image called with URL: ", image_url)
	
	if not background_texture_rect:
		print("❌ BackgroundTextureRect non trouvé!")
		return
		
	if not background_http_request:
		print("❌ Background HTTPRequest non trouvé!")
		return
	
	if image_url.is_empty():
		print("⚠️ URL d'image de fond vide")
		return
	
	print("🖼️ BackgroundTextureRect trouvé: ", background_texture_rect.name)
	print("🖼️ Background HTTPRequest trouvé: ", background_http_request.name)
	print("🖼️ Chargement de l'image de fond: ", image_url)
	
	# Test: Create a simple colored texture first to verify the BackgroundTextureRect works
	var test_image = Image.create(800, 600, false, Image.FORMAT_RGBA8)
	test_image.fill(Color.RED)
	var test_texture = ImageTexture.new()
	test_texture.create_from_image(test_image)
	background_texture_rect.texture = test_texture
	print("🖼️ TEST: Applied red test texture to BackgroundTextureRect")
	
	var error = background_http_request.request(image_url)
	if error != OK:
		print("❌ Erreur lors de la requête d'image de fond: ", error)
	else:
		print("🖼️ Requête HTTP envoyée avec succès")

# ========================================
# FONCTIONS DE CONTRÔLE DU WINNER POPUP
# ========================================

func get_winner_popup():
	"""Récupérer la référence au WinnerPopup existant dans la scène Main"""
	var winner_popup = get_parent().get_node_or_null("WinnerPopup")
	if not winner_popup:
		print("❌ WinnerPopup non trouvé dans la scène Main!")
		return null
	return winner_popup

func show_winner_popup():
	"""Afficher le WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		winner_popup.show()
		print("🏆 WinnerPopup affiché")
	else:
		print("❌ Impossible d'afficher le WinnerPopup")

func hide_winner_popup():
	"""Cacher le WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		winner_popup.hide()
		print("🏆 WinnerPopup caché")
	else:
		print("❌ Impossible de cacher le WinnerPopup")

func set_winner_popup_position(x: float, y: float):
	"""Définir la position du WinnerPopup en 2D (POSITION RESPECTÉE - NON UTILISÉE)"""
	print("⚠️ Fonction set_winner_popup_position désactivée - position gérée manuellement")

func get_winner_popup_position() -> Vector2:
	"""Obtenir la position actuelle du WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		return winner_popup.position
	return Vector2.ZERO

func move_winner_popup_to_center():
	"""Centrer le WinnerPopup à l'écran (POSITION RESPECTÉE - NON UTILISÉE)"""
	print("⚠️ Fonction move_winner_popup_to_center désactivée - position gérée manuellement")

func move_winner_popup_to_top_center():
	"""Placer le WinnerPopup en haut au centre (POSITION RESPECTÉE - NON UTILISÉE)"""
	print("⚠️ Fonction move_winner_popup_to_top_center désactivée - position gérée manuellement")

func move_winner_popup_to_bottom_center():
	"""Placer le WinnerPopup en bas au centre (POSITION RESPECTÉE - NON UTILISÉE)"""
	print("⚠️ Fonction move_winner_popup_to_bottom_center désactivée - position gérée manuellement")

func set_winner_popup_scale(scale_x: float, scale_y: float):
	"""Définir l'échelle du WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		winner_popup.scale = Vector2(scale_x, scale_y)
		print("🏆 WinnerPopup échelle définie à: ", Vector2(scale_x, scale_y))
	else:
		print("❌ Impossible de définir l'échelle du WinnerPopup")

func set_winner_popup_z_index(z_index: int):
	"""Définir le z-index du WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		winner_popup.z_index = z_index
		print("🏆 WinnerPopup z-index défini à: ", z_index)
	else:
		print("❌ Impossible de définir le z-index du WinnerPopup")

func animate_winner_popup_appearance():
	"""Animer l'apparition du WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		# Commencer invisible
		winner_popup.modulate.a = 0.0
		winner_popup.show()
		
		# Animation d'apparition
		var tween = create_tween()
		tween.tween_property(winner_popup, "modulate:a", 1.0, 0.5)
		print("🏆 Animation d'apparition du WinnerPopup")
	else:
		print("❌ Impossible d'animer le WinnerPopup")

func animate_winner_popup_disappearance():
	"""Animer la disparition du WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		# Animation de disparition
		var tween = create_tween()
		tween.tween_property(winner_popup, "modulate:a", 0.0, 0.5)
		await tween.finished
		winner_popup.hide()
		print("🏆 Animation de disparition du WinnerPopup")
	else:
		print("❌ Impossible d'animer la disparition du WinnerPopup")

func display_winner_data(winner_data: Dictionary):
	"""Afficher les données du gagnant dans le WinnerPopup"""
	var winner_popup = get_winner_popup()
	if winner_popup:
		winner_popup.show_winner(winner_data)
		print("🏆 Données du gagnant affichées dans le WinnerPopup")
	else:
		print("❌ Impossible d'afficher les données du gagnant")

# Exemple d'utilisation combinée
func show_winner_announcement(winner_data: Dictionary):
	"""Afficher une annonce complète du gagnant avec animation"""
	print("🏆 Annonce complète du gagnant...")
	
	# S'assurer qu'elle est au-dessus de tout
	set_winner_popup_z_index(9999)
	
	# Afficher les données
	display_winner_data(winner_data)
	
	# Animer l'apparition
	animate_winner_popup_appearance()
	
	print("🏆 Annonce du gagnant terminée!")

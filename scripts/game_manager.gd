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

# Audio pour l'écran Ready
var ready_sound_player: AudioStreamPlayer
var ready_sound: AudioStream

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
	
	# Connexion WebSocket
	print("🌐 Tentative de connexion au serveur WebSocket...")
	var error = ws_client.connect_to_url("ws://localhost:8080")
	if error != OK:
		print("❌ Erreur de connexion WebSocket: ", error)
		return
	
	# Configuration de l'audio pour l'écran Ready
	_setup_ready_audio()
	
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
			_handle_player_update(message)
		"player_update":
			_handle_player_update(message)
		"player_removed":
			_handle_player_remove(message)
		"new_question":
			_handle_new_question(message)
		"start_timer":
			_handle_start_timer(message)
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
		_:
			print("❓ Message inconnu reçu: ", message_type)

func _handle_player_update(data: Dictionary):
	if match_ended:
		return
		
	# Vérifier que toutes les données nécessaires sont présentes
	if not data.has_all(["user", "points", "currentLevel"]):
		print("❌ Données invalides pour la mise à jour du joueur")
		return
		
	print("👤 Mise à jour du joueur: ", data.user)
	if not players.has(data.user):
		print("➕ Création d'un nouveau joueur...")
		_create_player(data)
	else:
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
	if not player_data.has("winner"):
		print("❌ Données de gagnant invalides")
		return
		
	var popup = winner_popup_scene.instantiate()
	add_child(popup)
	
	# Créer un dictionnaire avec les données nécessaires pour la popup
	var winner_data = {
		"winner": player_data.winner,
		"points": player_data.points if player_data.has("points") else 0
	}
	
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
	
	popup.show_winner(winner_data)
	
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
	
	# Supprimer la popup de victoire si elle existe
	for child in get_children():
		if child is Control and child.name == "WinnerPopup":
			child.queue_free()
	
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
	if not message.has("winner"):
		print("❌ Données de fin de match invalides")
		return
		
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

func _handle_start_timer(message: Dictionary):
	if question_ui:
		var timer_duration = message.get("timer", 5.0)  # Default to 5 seconds if not specified
		question_ui.start_timer(timer_duration)
		print("⏱️ Timer démarré avec ", timer_duration, " secondes")
	else:
		print("❌ QuestionUI non trouvé!")

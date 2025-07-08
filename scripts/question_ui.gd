extends Control

var question_label: Label
var timer_bar: ProgressBar
var timer_label: Label

var question_timer: Timer
var current_question_data: Dictionary = {}
var current_correct_answer: String = ""
var is_question_active: bool = false

# Audio components
var timer_sound_player: AudioStreamPlayer
var timer_sound: AudioStream
var correct_answer_sound_player: AudioStreamPlayer
var correct_answer_sound: AudioStream

func _ready():
	# Attendre un frame pour s'assurer que tous les nœuds sont prêts
	await get_tree().process_frame
	
	# Récupérer les références aux nœuds (corrigé pour correspondre à la structure réelle)
	question_label = get_node_or_null("Panel/QuestionLabel")
	timer_bar = get_node_or_null("Panel/TimerBar")
	timer_label = get_node_or_null("Panel/TimerLabel")
	
	# Vérifier que tous les nœuds nécessaires existent
	if not question_label:
		print("❌ ERREUR: QuestionLabel non trouvé!")
		return
	if not timer_bar:
		print("❌ ERREUR: TimerBar non trouvé!")
		return
	if not timer_label:
		print("❌ ERREUR: TimerLabel non trouvé!")
		return
	
	print("✅ Tous les nœuds de l'interface des questions trouvés")
	
	# Configuration initiale de l'interface
	visible = false  # Cacher au démarrage
	z_index = 999  # S'assurer qu'on est au-dessus de tout
	modulate = Color.WHITE  # S'assurer qu'on n'est pas transparent
	
	# Cacher l'interface au démarrage
	hide()
	z_index = 999  # Juste en dessous de la popup de victoire
	
	# Créer le timer pour la question
	question_timer = Timer.new()
	add_child(question_timer)
	question_timer.timeout.connect(_on_question_timer_timeout)
	
	# Créer le lecteur audio pour le son du timer
	_setup_audio()
	
	# Charger le son du timer
	load_timer_sound("res://assets/sounds/timer_sound.ogg")

func _setup_audio():
	# Créer le lecteur audio pour le son du timer
	timer_sound_player = AudioStreamPlayer.new()
	add_child(timer_sound_player)
	timer_sound_player.name = "TimerSoundPlayer"
	
	# Configuration du lecteur audio
	timer_sound_player.volume_db = -10.0  # Volume modéré
	timer_sound_player.bus = "Master"  # Utiliser le bus audio principal
	
	# Créer le lecteur audio pour le son de bonne réponse
	correct_answer_sound_player = AudioStreamPlayer.new()
	add_child(correct_answer_sound_player)
	correct_answer_sound_player.name = "CorrectAnswerSoundPlayer"
	
	# Configuration du lecteur audio de bonne réponse
	correct_answer_sound_player.volume_db = -5.0  # Volume modéré
	correct_answer_sound_player.bus = "Master"  # Utiliser le bus audio principal
	
	print("🔊 Lecteur audio du timer créé")
	print("🔊 Lecteur audio de bonne réponse créé")
	
	# Assigner le son s'il a déjà été chargé
	if timer_sound:
		timer_sound_player.stream = timer_sound
		print("✅ Son pré-chargé assigné au lecteur.")
	
	# Charger le son de bonne réponse
	load_correct_answer_sound("res://assets/sounds/good-answer-quest.ogg")

func _update_option_text(option_button, text):
	"""Helper function pour mettre à jour le texte d'une option"""
	print("🔍 Tentative de mise à jour du texte: ", text)
	
	if option_button:
		print("✅ Bouton trouvé: ", option_button.name)
		
		# Chercher un Label à l'intérieur du bouton
		var label = option_button.get_node_or_null("Label")
		if label:
			print("✅ Label trouvé dans le bouton, mise à jour du texte")
			label.text = text
			label.modulate = Color.WHITE
		else:
			print("❌ Pas de Label trouvé, mise à jour directe sur le bouton")
			# Fallback: mettre le texte directement sur le bouton
			option_button.text = text
			option_button.modulate = Color.WHITE
		
		# Debug: afficher tous les enfants du bouton
		print("📋 Enfants du bouton ", option_button.name, ":")
		for child in option_button.get_children():
			print("  - ", child.name, " (", child.get_class(), ")")
	else:
		print("❌ Bouton non trouvé")

func show_question(question_data: Dictionary):
	if not question_label:
		print("❌ ERREUR: Nœuds de l'interface des questions non trouvés!")
		return
	
	# Reset button colors to white (without touching scale)
	_reset_button_colors()
	
	current_question_data = question_data
	is_question_active = true
	
	var current_time = Time.get_datetime_string_from_system()
	print("🔍 [", current_time, "] Tentative d'affichage de question...")
	print("✅ [", current_time, "] Question marquée comme active")
	
	# Debug: afficher les tailles
	var panel = get_node("Panel")
	print("📏 Panel size: ", panel.size if panel else "N/A")
	print("📏 QuestionUI size: ", size)
	
	# Afficher la question
	question_label.text = question_data.question
	print("✅ Question text affiché: ", question_data.question)
	
	# Afficher les options
	var options = question_data.options
	print("📋 Enfants du Panel:")
	var panel_node = get_node("Panel")
	for child in panel_node.get_children():
		print("  - ", child.name, " (", child.get_class(), ")")
	
	# Utiliser les nœuds d'options existants
	var option_a = panel_node.get_node_or_null("OptionA")
	var option_b = panel_node.get_node_or_null("OptionB")
	var option_c = panel_node.get_node_or_null("OptionC")
	
	if option_a and option_b and option_c:
		print("✅ Utilisation des nœuds d'options existants")
	else:
		print("⚠️ Nœuds d'options manquants - veuillez créer OptionA, OptionB, OptionC dans Panel")
		return
	
	# Mettre à jour le texte des options
	if options.size() > 0:
		_update_option_text(option_a, "" + options[0])
	
	if options.size() > 1:
		_update_option_text(option_b, "" + options[1])
	
	if options.size() > 2:
		_update_option_text(option_c, "" + options[2])
	
	print("✅ Options affichées: ", options)
	
	# NE PAS démarrer le timer ici - il sera démarré séparément après la lecture TTS
	print("⏰ Timer NON démarré - en attente de la fin de la lecture TTS")
	
	# Configurer la barre de progression mais ne pas la démarrer
	timer_bar.visible = true
	timer_bar.max_value = 7  # Durée réelle du timer (7 secondes)
	timer_bar.value = 7  # Commencer pleine dès l'affichage de la question
	
	# S'assurer que le label du timer est visible mais vide
	timer_label.visible = true
	timer_label.text = "En attente..."
	
	# Afficher l'interface
	show()
	print("✅ Interface affichée (show() appelé)")
	
	# Attendre un court délai pour s'assurer que l'interface est rendue
	await get_tree().process_frame
	await get_tree().process_frame
	
	# Forcer la mise à jour de la visibilité et du z-index
	visible = true
	z_index = 999  # S'assurer qu'on est au-dessus
	modulate = Color.WHITE  # S'assurer qu'on n'est pas transparent
	
	timer_bar.visible = true
	timer_label.visible = true
	
	# Vérifier que l'interface est bien visible
	if visible:
		print("✅ Interface confirmée visible")
	else:
		print("❌ ERREUR: Interface pas visible après show()")
		# Forcer la visibilité
		visible = true
		print("🔄 Visibilité forcée")
	
	# Vérifier le z-index
	print("📊 Z-index actuel: ", z_index)
	
	print("❓ Question affichée: ", question_data.question)
	print("⏰ Timer en attente de démarrage...")
	print("📊 Barre de progression: max=", timer_bar.max_value, " value=", timer_bar.value)

func start_timer(timer_duration: float):
	"""Démarre le timer après la fin de la lecture TTS"""
	if not is_question_active:
		print("❌ ERREUR: Aucune question active pour démarrer le timer")
		return
	
	print("⏱️ Démarrage du timer avec ", timer_duration, " secondes")
	
	# Configurer et démarrer le timer
	timer_bar.max_value = timer_duration
	timer_bar.value = timer_duration  # Démarre pleine
	timer_bar.visible = true
	
	question_timer.wait_time = timer_duration
	question_timer.start()
	
	# Démarrer le son du timer
	_start_timer_sound()
	
	# Mettre à jour le label du timer
	timer_label.visible = true
	timer_label.text = str(int(timer_duration)) + "s"
	
	print("✅ Timer démarré avec ", timer_duration, " secondes")
	print("📊 Barre de progression: max=", timer_bar.max_value, " value=", timer_bar.value)

func _start_timer_sound():
	if timer_sound_player:
		print("🔊 Tentative de lecture du son du timer...")
		if timer_sound_player.stream:
			print("✅ Fichier son assigné au lecteur.")
			print("📊 Volume du lecteur: ", timer_sound_player.volume_db, " dB")
			if timer_sound_player.is_playing():
				print("⚠️ Le son est déjà en cours de lecture.")
			else:
				timer_sound_player.play()
				if timer_sound_player.is_playing():
					print("▶️ Son du timer démarré avec succès !")
				else:
					print("❌ ERREUR: La lecture du son a échoué après l'appel à play().")
		else:
			print("❌ ERREUR: Pas de fichier son (stream) dans le lecteur audio.")
	else:
		print("❌ ERREUR: Lecteur audio (timer_sound_player) non trouvé.")

func _stop_timer_sound():
	if timer_sound_player:
		if timer_sound_player.is_playing():
			timer_sound_player.stop()
			print("🔇 Son du timer arrêté")
		else:
			print("🔇 Le son du timer n'était pas en cours de lecture.")
	else:
		print("❌ ERREUR: Lecteur audio (timer_sound_player) non trouvé pour l'arrêt.")

func load_timer_sound(sound_path: String):
	"""Charge le son du timer depuis le chemin fourni"""
	print("🎵 Tentative de chargement du son: ", sound_path)
	if ResourceLoader.exists(sound_path):
		timer_sound = load(sound_path)
		print("✅ Son chargé en mémoire: ", sound_path)
		# Si le lecteur audio est déjà prêt, assigner le son directement
		if timer_sound_player:
			timer_sound_player.stream = timer_sound
			print("✅ Son assigné directement au lecteur audio.")
	else:
		print("❌ Fichier son non trouvé: ", sound_path)

func _on_question_timer_timeout():
	if not is_question_active:
		return
	
	is_question_active = false
	question_timer.stop()
	
	# Arrêter le son du timer
	_stop_timer_sound()
	
	var current_time = Time.get_datetime_string_from_system()
	print("⏰ [", current_time, "] Temps écoulé pour la question")
	
	# Ne plus appeler show_correct_answer() ici car le serveur s'en charge
	# via le message question_ended qui sera reçu juste après
	
	# Ne plus cacher automatiquement l'interface ici car le serveur gère le timing
	# via les messages show_ready et new_question

func _process(delta):
	if is_question_active and question_timer and timer_bar and timer_label:
		# Ne mettre à jour la barre que si le timer est actif (pas en attente)
		if not question_timer.is_stopped():
			# Mettre à jour la barre de progression (commence pleine et diminue)
			var remaining_time = question_timer.time_left
			timer_bar.value = remaining_time  # Diminue au fil du temps
			
			# Mettre à jour le label du timer
			timer_label.text = str(int(remaining_time)) + "s"
			
			# Debug: afficher le temps restant toutes les secondes
			if int(remaining_time) != int(question_timer.time_left + delta):
				print("⏰ Temps restant: ", int(remaining_time), "s")

func set_correct_answer(correct_answer: String):
	current_correct_answer = correct_answer
	print("✅ Réponse correcte définie: ", correct_answer)

func show_correct_answer():
	if not current_question_data:
		print("❌ ERREUR: Aucune question active pour afficher la réponse correcte")
		return
	
	if current_correct_answer.is_empty():
		print("❌ ERREUR: Aucune réponse correcte définie")
		return
	
	print("✅ Affichage de la réponse correcte: ", current_correct_answer)
	
	# Find the correct button and make its label green
	var correct_button = null
	var button_name = ""
	
	# Get the Panel node first
	var panel = get_node("Panel")
	
	match current_correct_answer.to_upper():
		"A":
			correct_button = panel.get_node_or_null("OptionA")
			button_name = "OptionA"
		"B":
			correct_button = panel.get_node_or_null("OptionB")
			button_name = "OptionB"
		"C":
			correct_button = panel.get_node_or_null("OptionC")
			button_name = "OptionC"
	
	if correct_button:
		# Find the Label inside the button and make it green
		var label = correct_button.get_node_or_null("Label")
		if label:
			label.modulate = Color.GREEN
			print("✅ Label du bouton ", button_name, " mis en vert")
			
			# Play the correct answer sound
			if correct_answer_sound_player and correct_answer_sound_player.stream:
				correct_answer_sound_player.play()
				print("🔊 Son de bonne réponse joué")
			else:
				print("❌ Lecteur audio ou stream manquant pour le son de bonne réponse")
		else:
			print("⚠️ Label non trouvé dans le bouton ", button_name)
	else:
		print("❌ ERREUR: Bouton correct non trouvé pour la réponse: ", current_correct_answer)

func hide_question():
	is_question_active = false
	if question_timer:
		question_timer.stop()
	
	# Arrêter le son du timer
	_stop_timer_sound()
	
	hide()

func _reset_button_colors():
	# Reset all button label colors to white (without touching scale)
	var panel = get_node("Panel")
	
	var option_a = panel.get_node_or_null("OptionA")
	if option_a:
		var label = option_a.get_node_or_null("Label")
		if label:
			label.modulate = Color.WHITE
	
	var option_b = panel.get_node_or_null("OptionB")
	if option_b:
		var label = option_b.get_node_or_null("Label")
		if label:
			label.modulate = Color.WHITE
	
	var option_c = panel.get_node_or_null("OptionC")
	if option_c:
		var label = option_c.get_node_or_null("Label")
		if label:
			label.modulate = Color.WHITE
	
	print("✅ Couleurs des labels des boutons réinitialisées")

func load_correct_answer_sound(sound_path: String):
	"""Charge le son de bonne réponse depuis le chemin fourni"""
	print("🎵 Tentative de chargement du son: ", sound_path)
	if ResourceLoader.exists(sound_path):
		correct_answer_sound = load(sound_path)
		print("✅ Son chargé en mémoire: ", sound_path)
		# Si le lecteur audio est déjà prêt, assigner le son directement
		if correct_answer_sound_player:
			correct_answer_sound_player.stream = correct_answer_sound
			print("✅ Son assigné directement au lecteur audio.")
	else:
		print("❌ Fichier son non trouvé: ", sound_path)

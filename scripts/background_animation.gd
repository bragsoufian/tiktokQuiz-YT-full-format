extends TextureRect

# Animation parameters
var zoom_min = 1.0
var zoom_max = 1.1
var zoom_duration = 8.0  # seconds for one complete zoom cycle
var rotation_range = 2.0  # degrees
var rotation_duration = 12.0  # seconds for one complete rotation cycle

# Animation state
var zoom_time = 0.0
var rotation_time = 0.0
var initial_scale = Vector2.ONE

func _ready():
	# Store initial scale
	initial_scale = scale
	# Set initial position to center
	pivot_offset = size / 2

func _process(delta):
	# Update zoom animation
	zoom_time += delta
	var zoom_progress = fmod(zoom_time, zoom_duration) / zoom_duration
	var zoom_factor = zoom_min + (zoom_max - zoom_min) * (sin(zoom_progress * TAU) * 0.5 + 0.5)
	
	# Update rotation animation
	rotation_time += delta
	var rotation_progress = fmod(rotation_time, rotation_duration) / rotation_duration
	var rotation_angle = deg_to_rad(rotation_range * sin(rotation_progress * TAU))
	
	# Apply transformations
	scale = initial_scale * zoom_factor
	rotation = rotation_angle 
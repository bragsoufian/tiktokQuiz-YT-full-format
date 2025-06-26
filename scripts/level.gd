extends StaticBody2D

@onready var collision_shape = $rectangle

func _ready():
	# Make sure the level is visible but doesn't affect children
	modulate = Color(1, 1, 1, 1)

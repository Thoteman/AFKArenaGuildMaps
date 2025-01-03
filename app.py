from flask import Flask, render_template, jsonify, request, redirect, url_for, session, send_from_directory, Response
from flask_discord import DiscordOAuth2Session, requires_authorization, Unauthorized
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import json
import os

app = Flask(__name__)

# Load the .env file
load_dotenv()

# App Configuration
app.secret_key = os.getenv("SECRET_KEY")
app.config["DISCORD_CLIENT_ID"] = os.getenv("DISCORD_CLIENT_ID")
app.config["DISCORD_CLIENT_SECRET"] = os.getenv("DISCORD_CLIENT_SECRET")
app.config["DISCORD_REDIRECT_URI"] = os.getenv("DISCORD_REDIRECT_URI")
app.config["DISCORD_BOT_TOKEN"] = os.getenv("DISCORD_BOT_TOKEN")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
app.config['ENV'] = 'production'
app.config['DEBUG'] = False

# Initialize extensions
discord = DiscordOAuth2Session(app)
db = SQLAlchemy(app)

# Path to your resources
BASE_PATH = os.path.abspath(".")
MAPS = {
    "home": {"image": None, "tiles": None},  # Home screen, no image or tile data
    "Abyssal Expedition": {"image": "static/res/abex_map.png", "tiles": "static/res/SLG_tiles.json"},
    "Hunting Fields": {"image": "static/res/hf_map.png", "tiles": "static/res/GVE_tiles.json"},
    # Add more maps here if needed
}

# Database Model
class Marker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    map_name = db.Column(db.String(50), nullable=False)
    markers = db.Column(db.Text, nullable=False)  # Store as JSON string

# Routes
@app.route("/")
def index():
    user = session.get("user")  # Get user info from session
    return render_template("index.html", user=user)

@app.route("/login/")
def login():
    return discord.create_session(scope=["identify"])

@app.route("/callback/")
def callback():
    session.pop("_oauth2_state", None)  # Clear the state to avoid mismatches
    discord.callback()
    user = discord.fetch_user()
    session["user"] = {
        "id": user.id,
        "name": user.username,
        "discriminator": user.discriminator,
        "avatar": user.avatar_url,
    }
    return redirect(url_for("index"))


@app.route("/logout/")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.errorhandler(Unauthorized)
def unauthorized(e):
    return redirect(url_for("index"))

@app.route("/map/<map_name>")
@requires_authorization
def map_page(map_name):
    if map_name not in MAPS:
        return "Map not found", 404
    map_info = MAPS[map_name]
    return render_template("map_page.html", map_name=map_name, image_path=map_info["image"], tile_file=map_info["tiles"])

@app.route("/get_tiles/<map_name>")
@requires_authorization
def get_tiles(map_name):
    if map_name not in MAPS:
        return "Map not found", 404
    tile_file = MAPS[map_name]["tiles"]
    tile_positions = load_tile_positions(tile_file)
    return jsonify(tile_positions)

@app.route("/get_map/<map_name>")
@requires_authorization
def get_map(map_name):
    if map_name not in MAPS:
        return "Map not found", 404

    image_path = MAPS[map_name]["image"]
    return send_from_directory(BASE_PATH, image_path)

@app.route("/save_markers/", methods=["POST"])
@requires_authorization
def save_markers():
    data = request.get_json()
    map_name = data["map_name"]
    markers = json.dumps(data["markers"])  # Convert to JSON string
    user_id = session["user"]["id"]

    # Upsert marker data (update if exists, insert if not)
    marker = Marker.query.filter_by(user_id=user_id, map_name=map_name).first()
    if marker:
        marker.markers = markers
    else:
        marker = Marker(user_id=user_id, map_name=map_name, markers=markers)
        db.session.add(marker)
    
    db.session.commit()  # Commit the changes to the database
    return jsonify({"status": "success"})

@app.route("/get_markers/<map_name>")
@requires_authorization
def get_markers(map_name):
    user_id = session["user"]["id"]
    marker = Marker.query.filter_by(user_id=user_id, map_name=map_name).first()
    if marker:
        return jsonify(json.loads(marker.markers))
    return jsonify([])

# Helper function to load tile positions
def load_tile_positions(file_path):
    with open(file_path, "r") as f:
        return json.load(f)

# Create database tables on application startup
with app.app_context():
    db.create_all()

# Run the app
if __name__ == "__main__":
    app.run()



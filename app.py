from flask import Flask, render_template, jsonify, request, redirect, url_for, session, send_from_directory
from flask_discord import DiscordOAuth2Session, requires_authorization, Unauthorized
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import json
import os

# Enable HTTP transport for OAuth (development)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Initialize Flask app
app = Flask(__name__)

# Load environment variables
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

# Tile map configuration
MAPS = {
    "home": {"tiles_root": None},  # Placeholder for non-map homepage
    "Abyssal Expedition": {"tiles_root": "static/tiles/abex"},
    "Hunting Fields": {"tiles_root": "static/tiles/hf"},
    # Add more maps as needed
}

# Database Model
class Marker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    map_name = db.Column(db.String(50), nullable=False)
    markers = db.Column(db.Text, nullable=False)  # JSON string of marker data

# Routes
@app.route("/")
def index():
    user = session.get("user")
    return render_template("index.html", user=user)

@app.route("/login/")
def login():
    return discord.create_session(scope=["identify"])

@app.route("/callback/")
def callback():
    session.pop("_oauth2_state", None)
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
    return render_template("map_page.html", map_name=map_name, tiles_root=map_info["tiles_root"])

@app.route("/save_markers/", methods=["POST"])
@requires_authorization
def save_markers():
    data = request.get_json()
    map_name = data["map_name"]
    markers = json.dumps(data["markers"])
    user_id = session["user"]["id"]

    marker = Marker.query.filter_by(user_id=user_id, map_name=map_name).first()
    if marker:
        marker.markers = markers
    else:
        marker = Marker(user_id=user_id, map_name=map_name, markers=markers)
        db.session.add(marker)
    
    db.session.commit()
    return jsonify({"status": "success"})

@app.route("/get_markers/<map_name>")
@requires_authorization
def get_markers(map_name):
    user_id = session["user"]["id"]
    marker = Marker.query.filter_by(user_id=user_id, map_name=map_name).first()
    if marker:
        return jsonify(json.loads(marker.markers))
    return jsonify([])

# Initialize DB
with app.app_context():
    db.create_all()

# Run the app
if __name__ == "__main__":
    app.run()

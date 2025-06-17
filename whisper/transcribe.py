from flask import Flask, request, jsonify
import whisper
import tempfile
import os
import subprocess

app = Flask(__name__)
model = whisper.load_model("small")

def convert_to_wav(input_path):
    output_path = input_path + ".wav"
    command = [
        "ffmpeg", "-y", "-i", input_path,
        "-ar", "16000", "-ac", "1", output_path
    ]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return output_path

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No file"}), 400

    audio = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix=".ogg") as tmp:
        audio.save(tmp)
        ogg_path = tmp.name

    try:
        wav_path = convert_to_wav(ogg_path)
        print(f"я запустился и я молодец")
        result = model.transcribe(wav_path, language='ru')
        print(jsonify({"text": result["text"]}))
        return jsonify({"text": result["text"]})
    finally:
        os.remove(ogg_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == '__main__':
    app.run(port=5005)

import json
import logging
import os

from ifcclash.ifcclash import Clasher, ClashSettings

BASE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(BASE, "..", "..", "public", "models")

logging.basicConfig(level=logging.INFO)

settings = ClashSettings()
settings.logger = logging.getLogger("ifcclash")
settings.output = os.path.join(BASE, "clashes.json")

clasher = Clasher(settings)
clasher.clash_sets = [
    {
        "name": "Structure vs Toiture",
        "a": [{"file": os.path.join(MODELS, "Projet_structure.ifc")}],
        "b": [{"file": os.path.join(MODELS, "Toit_Metal_2.ifc")}],
        "mode": "collision",
        "allow_touching": False,
    }
]

clasher.clash()
clasher.export()

with open(settings.output, encoding="utf-8") as f:
    data = json.load(f)

for clash_set in data:
    print(f"\n=== {clash_set['name']} : {len(clash_set['clashes'])} clash(es) ===")
    for key, clash in clash_set["clashes"].items():
        print(
            f"- {clash['a_ifc_class']} ({clash['a_name']}) x "
            f"{clash['b_ifc_class']} ({clash['b_name']}) "
            f"distance={clash['distance']:.4f}"
        )

#!/bin/bash
# ============================================================
#  ClubLab WIMU GPS Agent — Instalador macOS / Linux
#  Compatible con macOS 12+ y Ubuntu/Debian
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo ""
echo " ============================================================"
echo "  ClubLab | Instalador del Agente GPS Local  (macOS / Linux)"
echo " ============================================================"
echo ""

# ── Verificar Python 3 ────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo " [ERROR] Python 3 no encontrado."
    echo ""
    echo " macOS: instala con Homebrew:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "   brew install python"
    echo ""
    echo " Ubuntu/Debian:"
    echo "   sudo apt-get install python3 python3-venv python3-pip"
    echo ""
    exit 1
fi

PYVER=$(python3 --version 2>&1)
echo " Python encontrado: $PYVER"

# ── Crear entorno virtual ─────────────────────────────────────
echo ""
echo " Creando entorno virtual en: $VENV_DIR"
python3 -m venv "$VENV_DIR"

# ── Instalar dependencias ─────────────────────────────────────
echo ""
echo " Instalando dependencias (requests, numpy, scikit-learn)..."
"$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/requirements.txt" --quiet

# ── Crear script de ejecución ─────────────────────────────────
RUNNER="$SCRIPT_DIR/run_agent.sh"
cat > "$RUNNER" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/wimu_agent.py" "$@"
EOF
chmod +x "$RUNNER"

echo ""
echo " ============================================================"
echo "  ¡Instalación completada con éxito!"
echo " ============================================================"
echo ""
echo " USO:"
echo "   1. Descarga el wimu_config.json desde ClubLab"
echo "      (Rendimiento → Ajustes → Agente GPS Local)"
echo ""
echo "   2. Ejecuta el agente:"
echo "      ./run_agent.sh --config wimu_config.json"
echo ""
echo "   3. O especifica la carpeta manualmente:"
echo "      ./run_agent.sh --config wimu_config.json --folder /ruta/GPS/Partido"
echo ""
echo "   4. Para guardar el output localmente primero:"
echo "      ./run_agent.sh --config wimu_config.json --output wimu_output.json"
echo ""

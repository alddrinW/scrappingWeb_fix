#!/bin/bash
# Archivo: start-vnc.sh

# Instalar dependencias necesarias:
sudo apt-get install -y xvfb x11vnc fluxbox websockify novnc

sleep 3
# Configurar la contraseña de VNC:


# Limpia el entorno:

pkill -9 Xvfb
pkill -9 x11vnc
pkill -9 fluxbox
pkill -9 websockify
rm -f /tmp/.X99-lock
rm -f /tmp/.X11-unix/X99
rm -f ~/.vnc/*.pid
rm -f ~/.vnc/*.log
rm -f /tmp/*.log

# Inicia Xvfb 

Xvfb :99 -screen 0 1280x800x24 -ac 2>/tmp/xvfb.log &
export DISPLAY=:99
sleep 3

# Inicia fluxbox:

fluxbox -display :99 2>/tmp/fluxbox.log &
sleep 2

# Inicia x11vnc:

x11vnc -display :99 -geometry 1920x1080 -forever -shared -rfbport 5900 -nopw 2>/tmp/x11vnc.log &
sleep 2

# Inicia websockify:
# Configurar la ruta de noVNC cuando sea necesario, también configurar la IP según el servidor

websockify --web=/usr/share/novnc --verbose 6080 localhost:5900 2>/tmp/websockify.log &
sleep 2

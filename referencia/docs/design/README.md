# Diseño de referencia

`parrilla-referencia.html` es la ESPECIFICACIÓN VISUAL de la parrilla, generada 
con Claude Design y aprobada tras comparar tres direcciones.

⚠️ NO ES CÓDIGO A PORTAR. Contiene datos falsos hardcodeados (nombres, turnos).
Es una referencia de cómo debe VERSE la parrilla, no de cómo debe construirse.

La implementación real vive en resources/js/ y se construye contra el motor.

## Lo que el diseño establece
- Vista semana (7 días × puestos) como principal
- Carriles: cada persona en su línea, nombre y hora completos
- El tiempo es el eje X: los turnos son barras posicionadas por su hora real
- El hueco de cobertura se pinta DONDE OCURRE (segmentos), no en toda la franja
- Semántica reservada: rojo = imposible/incumplimiento · ámbar = aviso · verde = correcto
- La marca es índigo precisamente para no competir con esa semántica
<!DOCTYPE html>
<html lang="es" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    {{-- Las tres rutas que ESCRIBEN se llaman con fetch, no con un formulario de Inertia (no son
         navegaciones: soltar una barra no cambia de página). Y una petición con fetch no lleva el
         token de sesión por su cuenta: hay que dárselo. --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title inertia>Turnia</title>

    {{-- Las fuentes van AUTOALOJADAS: Vite las descarga en el build y las sirve desde
         nuestro dominio. Ni una petición a un CDN. La app va detrás de login y guarda
         datos sanitarios: no debe filtrar a terceros ni siquiera quién la abre. --}}
    {{ Vite::fonts() }}

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <x-inertia::head />
</head>
<body class="h-full antialiased">
    <x-inertia::app />
</body>
</html>

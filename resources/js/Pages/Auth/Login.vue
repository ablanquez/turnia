<script setup>
import { Link, useForm } from '@inertiajs/vue3';

defineProps({
    status: { type: String, default: null },
});

const form = useForm({
    email: '',
    password: '',
    remember: false,
});

const submit = () => form.post('/login', {
    onFinish: () => form.reset('password'),
});
</script>

<template>
    <div class="flex min-h-screen items-center justify-center px-4">
        <div class="w-full max-w-sm">
            <div class="mb-8 flex flex-col items-center gap-3">
                <svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true">
                    <circle
                        cx="20" cy="20" r="14" fill="none"
                        stroke="#7F77DD" stroke-width="5" stroke-dasharray="7.5 3.8"
                    />
                    <circle cx="20" cy="20" r="4.5" fill="#534AB7" />
                </svg>
                <span class="text-xl font-bold tracking-tight text-brand-800">TURNIA</span>
            </div>

            <div class="rounded-xl border border-line bg-white p-7 shadow-sm">
                <p v-if="status" class="mb-4 text-sm font-medium text-brand-600">
                    {{ status }}
                </p>

                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-ink">Correo</span>
                        <input
                            v-model="form.email"
                            type="email"
                            autocomplete="username"
                            required
                            autofocus
                            class="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                        >
                    </label>

                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-ink">Contraseña</span>
                        <input
                            v-model="form.password"
                            type="password"
                            autocomplete="current-password"
                            required
                            class="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                        >
                    </label>

                    <!--
                        Un solo mensaje de error, y deliberadamente vago: Fortify no
                        distingue "no existe ese correo" de "la contraseña no es esa", y
                        hace bien. Distinguirlo permitiría averiguar quién tiene cuenta.
                    -->
                    <p v-if="form.errors.email" class="text-xs font-medium text-impossible">
                        {{ form.errors.email }}
                    </p>

                    <label class="flex items-center gap-2 text-xs text-ink-soft">
                        <input v-model="form.remember" type="checkbox" class="accent-brand-600">
                        Mantener la sesión abierta
                    </label>

                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="mt-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                    >
                        Entrar
                    </button>
                </form>
            </div>

            <div class="mt-4 text-center">
                <Link
                    href="/forgot-password"
                    class="text-xs font-medium text-brand-600 hover:text-brand-800"
                >
                    He olvidado la contraseña
                </Link>
            </div>
        </div>
    </div>
</template>

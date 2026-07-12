<script setup>
import { Link, useForm } from '@inertiajs/vue3';

defineProps({
    status: { type: String, default: null },
});

const form = useForm({ email: '' });

const submit = () => form.post('/forgot-password');
</script>

<template>
    <div class="flex min-h-screen items-center justify-center px-4">
        <div class="w-full max-w-sm">
            <h1 class="mb-2 text-lg font-bold text-brand-800">Recuperar la contraseña</h1>
            <p class="mb-6 text-sm text-ink-soft">
                Te enviamos un enlace para elegir una nueva.
            </p>

            <div class="rounded-xl border border-line bg-white p-7 shadow-sm">
                <p v-if="status" class="mb-4 text-sm font-medium text-ok">
                    {{ status }}
                </p>

                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-ink">Correo</span>
                        <input
                            v-model="form.email"
                            type="email"
                            required
                            autofocus
                            class="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-300"
                        >
                    </label>

                    <p v-if="form.errors.email" class="text-xs font-medium text-impossible">
                        {{ form.errors.email }}
                    </p>

                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="mt-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
                    >
                        Enviar el enlace
                    </button>
                </form>
            </div>

            <div class="mt-4 text-center">
                <Link href="/login" class="text-xs font-medium text-brand-600 hover:text-brand-800">
                    Volver a entrar
                </Link>
            </div>
        </div>
    </div>
</template>

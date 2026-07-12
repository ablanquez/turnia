<script setup>
import { useForm } from '@inertiajs/vue3';

const props = defineProps({
    email: { type: String, required: true },
    token: { type: String, required: true },
});

const form = useForm({
    token: props.token,
    email: props.email,
    password: '',
    password_confirmation: '',
});

const submit = () => form.post('/reset-password', {
    onFinish: () => form.reset('password', 'password_confirmation'),
});
</script>

<template>
    <div class="flex min-h-screen items-center justify-center px-4">
        <div class="w-full max-w-sm">
            <h1 class="mb-6 text-lg font-bold text-[--color-brand-800]">Nueva contraseña</h1>

            <div class="rounded-xl border border-[--color-line] bg-white p-7 shadow-sm">
                <form class="flex flex-col gap-4" @submit.prevent="submit">
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-[--color-ink]">Correo</span>
                        <input
                            v-model="form.email"
                            type="email"
                            required
                            class="rounded-lg border border-[--color-line] px-3 py-2 text-sm outline-none focus:border-[--color-brand-300]"
                        >
                    </label>

                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-[--color-ink]">Contraseña nueva</span>
                        <input
                            v-model="form.password"
                            type="password"
                            autocomplete="new-password"
                            required
                            autofocus
                            class="rounded-lg border border-[--color-line] px-3 py-2 text-sm outline-none focus:border-[--color-brand-300]"
                        >
                    </label>

                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-semibold text-[--color-ink]">Repítela</span>
                        <input
                            v-model="form.password_confirmation"
                            type="password"
                            autocomplete="new-password"
                            required
                            class="rounded-lg border border-[--color-line] px-3 py-2 text-sm outline-none focus:border-[--color-brand-300]"
                        >
                    </label>

                    <p
                        v-for="error in Object.values(form.errors)"
                        :key="error"
                        class="text-xs font-medium text-[--color-impossible]"
                    >
                        {{ error }}
                    </p>

                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="mt-1 rounded-lg bg-[--color-brand-600] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[--color-brand-800] disabled:opacity-60"
                    >
                        Guardar
                    </button>
                </form>
            </div>
        </div>
    </div>
</template>

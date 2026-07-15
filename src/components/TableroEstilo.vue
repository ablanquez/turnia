<script setup>
/*
 * TABLERO DE ESTILO VIVO — las cuatro familias juntas, y el medidor de la ley.
 *
 * ⚠️ NO copia colores: los LEE de la fuente. La identidad, de paleta.js; los tokens fijos, de la
 * PÁGINA (getComputedStyle sobre las variables reales). El hex que se enseña al lado es el leído,
 * no uno tecleado — así no puede desincronizarse (el pecado del tablero de ZGZ).
 *
 * Y mide: ΔE mínimo entre personas (D), distancia de cada persona a estados (≥24) y a fondos/marca
 * (≥8), croma (≥30) y R < D/2. Si algo colisiona, saca banda roja con el par culpable.
 */
import { reactive, ref, onMounted } from 'vue';
import Marca from '../estilo/marca/Marca.vue';
import { IDENTIDAD } from '../datos/paleta.js';
import { FAMILIAS, todosLosTokens } from '../estilo/manifiesto.js';
import { auditar, UMBRAL_ESTADO, UMBRAL_MARCA, CROMA_MIN } from '../estilo/reglas.js';

const leido = reactive({});
const auditoria = ref(null);

onMounted(() => {
    const cs = getComputedStyle(document.documentElement);
    for (const t of todosLosTokens()) {
        leido[t.var] = cs.getPropertyValue(t.var).trim();
    }

    const tk = todosLosTokens();
    auditoria.value = auditar({
        identidad: IDENTIDAD.map((hex, i) => ({ nombre: `Persona ${String(i + 1).padStart(2, '0')}`, hex })),
        estados: tk.filter((t) => t.clase === 'estado').map((t) => ({ nombre: t.label, hex: leido[t.var] })),
        fondos: tk.filter((t) => t.clase === 'fondo').map((t) => ({ nombre: t.label, hex: leido[t.var] })),
    });
});

const uno = (n) => n.toFixed(1);
</script>

<template>
    <main class="min-h-screen bg-page px-5 py-10 text-ink md:px-8">
        <div class="mx-auto flex max-w-5xl flex-col gap-10">

            <!-- Cabecera -->
            <header class="flex flex-col gap-3">
                <Marca :tamano="30" />
                <h1 class="text-3xl font-bold tracking-tight">Sistema de diseño</h1>
                <p class="max-w-2xl text-sm text-ink-soft">
                    Las cuatro familias de color que no se mezclan — <strong>identidad · semántica ·
                    marca · composición</strong> — leídas de su fuente única, con el medidor de la ley
                    en vivo. El color aquí es información, no decoración.
                </p>
            </header>

            <!-- ══ EL MEDIDOR DE LA LEY ══ -->
            <section v-if="auditoria" class="flex flex-col gap-4">
                <div
                    class="rounded-xl border-2 p-5"
                    :class="auditoria.ok ? 'border-ok-edge bg-covered-fill' : 'border-missing-edge bg-missing-fill'"
                >
                    <p class="text-lg font-bold" :style="{ color: auditoria.ok ? 'var(--color-ok-text)' : 'var(--color-impossible-text)' }">
                        {{ auditoria.ok ? '✅ La ley se cumple' : `❌ ${auditoria.choques.length} choque(s): un color invade otra familia` }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-ink-soft">
                        <span>D (ΔE mín entre personas): <strong class="tabular text-ink">{{ uno(auditoria.D) }}</strong></span>
                        <span>D/2: <strong class="tabular text-ink">{{ uno(auditoria.D / 2) }}</strong></span>
                        <span>R: <strong class="tabular text-ink">{{ auditoria.R }}</strong></span>
                        <span>R &lt; D/2: <strong :class="auditoria.cumpleRD ? 'text-ink' : ''">{{ auditoria.cumpleRD ? '✅' : '❌' }}</strong></span>
                        <span>umbrales: estados ≥ {{ UMBRAL_ESTADO }} · fondos/marca ≥ {{ UMBRAL_MARCA }} · croma ≥ {{ CROMA_MIN }}</span>
                    </div>
                    <p v-if="!auditoria.ok" class="mt-3 flex flex-col gap-1 text-sm" :style="{ color: 'var(--color-impossible-text)' }">
                        <span v-for="(c, i) in auditoria.choques" :key="i">
                            · «{{ c.persona }}» a ΔE {{ uno(c.d) }} de «{{ c.contra }}» (umbral {{ c.umbral }})
                        </span>
                    </p>
                    <p class="mt-2 text-xs text-ink-faint">
                        R = 0 en el prototipo: las barras son de relleno plano; la trama, el anillo y el
                        alfa del Día —los canales que mueven el color— aún no existen. Se re-medirá al llegar.
                    </p>
                </div>
            </section>

            <!-- ══ 1 · IDENTIDAD ══ -->
            <section class="flex flex-col gap-4">
                <div>
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">1 · Identidad</h2>
                    <p class="mt-1 text-sm text-ink-soft">El color de cada persona. Es dato: se reparte por índice. Cada uno, su distancia al estado y al fondo más cercanos.</p>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div
                        v-for="(f, i) in (auditoria ? auditoria.filas : [])"
                        :key="i"
                        class="flex items-center gap-3 rounded-lg border border-line bg-card p-3"
                    >
                        <div class="h-11 w-11 flex-shrink-0 rounded-md border border-line" :style="{ background: f.hex }" />
                        <div class="flex min-w-0 flex-col gap-0.5 text-xs">
                            <span class="font-semibold text-ink">{{ f.persona }}</span>
                            <span class="tabular text-ink-soft">{{ f.hex }}</span>
                            <span class="text-ink-faint">
                                estado <strong :style="{ color: f.aEstado.d >= UMBRAL_ESTADO ? 'var(--color-ok-text)' : 'var(--color-impossible-text)' }">{{ uno(f.aEstado.d) }}</strong>
                                · fondo <strong :style="{ color: f.aFondo.d >= UMBRAL_MARCA ? 'var(--color-ok-text)' : 'var(--color-impossible-text)' }">{{ uno(f.aFondo.d) }}</strong>
                                · croma {{ f.croma.toFixed(0) }}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ══ 2-4 · SEMÁNTICA, MARCA, COMPOSICIÓN ══ -->
            <section v-for="(fam, fi) in FAMILIAS" :key="fam.familia" class="flex flex-col gap-4">
                <div>
                    <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">{{ fi + 2 }} · {{ fam.etiqueta }}</h2>
                    <p class="mt-1 text-sm text-ink-soft">
                        {{ fam.descripcion }}
                        <span class="text-ink-faint">— excluida frente a la identidad a ΔE {{ fam.clase === 'estado' ? UMBRAL_ESTADO : UMBRAL_MARCA }}.</span>
                    </p>
                </div>

                <div v-for="grupo in fam.grupos" :key="grupo.titulo" class="flex flex-col gap-2">
                    <h3 class="text-xs font-medium text-ink-faint">{{ grupo.titulo }}</h3>
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div
                            v-for="it in grupo.items"
                            :key="it.var"
                            class="flex items-center gap-3 rounded-lg border border-line bg-card p-3"
                        >
                            <div class="h-11 w-11 flex-shrink-0 rounded-md border border-line" :style="{ background: `var(${it.var})` }" />
                            <div class="flex min-w-0 flex-col gap-0.5 text-xs">
                                <span class="font-semibold text-ink">{{ it.label }}</span>
                                <span class="tabular text-ink-soft">{{ it.var }}</span>
                                <span class="tabular text-ink-faint">{{ leido[it.var] || '—' }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ══ Tipografía ══ -->
            <section class="flex flex-col gap-4">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">5 · Tipografía</h2>
                <div class="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
                    <div>
                        <p class="text-xs text-ink-faint">IBM Plex Sans — el texto</p>
                        <p class="font-sans text-2xl font-semibold text-ink">Cuadrante de la semana · lunes a domingo</p>
                        <p class="font-sans text-base text-ink-soft">Nombres, puestos y avisos. Peso 400 · 500 · 600 · 700.</p>
                    </div>
                    <div class="border-t border-line-soft pt-3">
                        <p class="text-xs text-ink-faint">IBM Plex Mono — las horas (cifras tabulares)</p>
                        <p class="tabular text-2xl font-medium text-ink">06:00 · 09:30 · 14:00 · 22:15</p>
                    </div>
                </div>
            </section>

            <footer class="border-t border-line pt-5 text-xs text-ink-faint">
                Fuente única: <span class="tabular">src/estilo/tokens.css</span> ·
                <span class="tabular">src/datos/paleta.js</span>. La ley: <span class="tabular">src/estilo/reglas.js</span>,
                verificada por <span class="tabular">contraste.check.mjs</span> y <span class="tabular">sin-hex.check.mjs</span>.
            </footer>
        </div>
    </main>
</template>

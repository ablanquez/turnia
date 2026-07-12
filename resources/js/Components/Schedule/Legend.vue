<template>
    <div
        class="flex flex-wrap items-center gap-5 border-b border-[--color-line] bg-[#F7F7FB] px-6 py-2.5 text-[11.5px]"
    >
        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[--color-ink-faint]">Estado</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span
                    class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-[--color-impossible]"
                    style="background: repeating-linear-gradient(45deg, rgba(200,30,30,.28) 0 4px, rgba(200,30,30,.1) 4px 8px)"
                />
                Imposible
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-[--color-breach] bg-[rgba(232,89,12,.1)]" />
                Incumplimiento
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-[1.5px] border-[--color-notice] bg-[rgba(217,164,0,.16)]" />
                Aviso
            </span>
        </div>

        <div class="h-4 w-px bg-[--color-line]" />

        <div class="flex flex-wrap items-center gap-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[--color-ink-faint]">Cobertura</span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-[--color-ok] bg-[rgba(21,128,61,.2)]" />
                Correcto
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-[--color-missing] bg-[rgba(220,38,38,.24)]" />
                Falta
            </span>

            <!-- El exceso NO es un error, y por eso NO es rojo: es índigo. Sobra gente,
                 que a veces es lo que quieres un sábado. -->
            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span class="h-3.5 w-3.5 rounded-sm border-t-[3px] border-[--color-brand-300] bg-[rgba(127,119,221,.24)]" />
                Exceso
            </span>

            <span class="flex items-center gap-1.5 text-[#41404E]">
                <span
                    class="h-3.5 w-3.5 rounded-sm border border-[#8A8A99]"
                    style="background: repeating-linear-gradient(45deg, #DEDEE6 0 4px, #F1F1F5 4px 8px)"
                />
                Sin candidato
            </span>
        </div>

        <div class="flex-1" />

        <span class="tabular text-[10px] text-[#A9A7B6]">
            cada columna = 1 día · el eje es la hora real
        </span>
    </div>
</template>

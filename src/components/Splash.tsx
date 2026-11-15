// Tela de abertura, no espírito das aberturas de jogo de futebol de 16 bits:
// céu noturno em faixas, gramado em perspectiva correndo de lado, o título
// caindo letra por letra e o "APERTE START" piscando.
//
// Aparece uma vez por visita (ao abrir o site ou o app instalado) e some
// sozinha; qualquer toque ou tecla pula. Tudo é CSS (ver "Abertura" em
// globals.css) e um script embutido, para começar antes de o React carregar.
import type { CSSProperties } from "react";
import { GarbageTruck } from "./GarbageTruck";
import { PlayerSprite } from "./PlayerSprite";
import { BallIcon, RecycleIcon } from "./icons";

/** Quanto tempo a abertura fica na tela antes de sumir sozinha (ms). */
const SPLASH_MS = 4000;

// Roda assim que o navegador lê a abertura, antes de pintar a página: decide se
// ela aparece (primeira página da visita, sem "reduzir movimento") e cuida de
// pular e de encerrar.
const script = `(function(){
var el=document.getElementById("splash");if(!el)return;
try{if(sessionStorage.getItem("copinha:abertura"))return;sessionStorage.setItem("copinha:abertura","1")}catch(e){}
if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
el.setAttribute("data-on","in");
var done=false;
function end(){if(done)return;done=true;el.setAttribute("data-on","out");document.removeEventListener("keydown",end);setTimeout(function(){el.removeAttribute("data-on")},450)}
el.addEventListener("click",end);
document.addEventListener("keydown",end);
setTimeout(end,${SPLASH_MS});
})()`;

const TITLE = "COPINHA";

export function Splash() {
  return (
    <>
      {/* O script liga o atributo data-on antes de o React assumir a página. */}
      <div id="splash" className="splash" aria-hidden="true" suppressHydrationWarning>
        <div className="splash-sky" />
        <div className="splash-stars" />
        <div className="splash-stars splash-stars-b" />

        <div className="splash-title">
          <RecycleIcon className="splash-emblem" />
          <div className="splash-word">
            {TITLE.split("").map((letter, i) => (
              <span
                key={i}
                className="splash-letter"
                style={{ "--i": i } as CSSProperties}
              >
                {letter}
              </span>
            ))}
          </div>
          <div className="splash-sub">DOS LIXOS</div>
        </div>

        <div className="stands splash-stands" />
        <div className="splash-pitch">
          <div className="splash-plane" />
        </div>

        {/* A bola na frente, dois jogadores atrás dela e o caminhão no encalço. */}
        <div className="splash-run walking">
          <div className="splash-runner" style={{ "--i": 0 } as CSSProperties}>
            <BallIcon width={22} height={22} className="splash-ball" />
          </div>
          <div className="splash-runner" style={{ "--i": 1 } as CSSProperties}>
            <div className="splash-bob">
              <PlayerSprite
                name="camisa 10"
                avatar={{ skin: 2, hair: 0, style: 1, shirt: 0 }}
                width={36}
              />
            </div>
          </div>
          <div className="splash-runner" style={{ "--i": 2 } as CSSProperties}>
            <div className="splash-bob splash-bob-b">
              <PlayerSprite
                name="camisa 7"
                avatar={{ skin: 0, hair: 3, style: 2, shirt: 3 }}
                width={36}
              />
            </div>
          </div>
          <div className="splash-runner" style={{ "--i": 4 } as CSSProperties}>
            <div className="splash-rumble">
              <GarbageTruck width={150} />
            </div>
          </div>
        </div>

        <div className="splash-start">
          <span className="blink">APERTE START</span>
        </div>

        <div className="splash-flash" />
        <div className="splash-black" />
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}

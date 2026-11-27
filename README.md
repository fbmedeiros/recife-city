# HELLCIFE — Recife em mundo aberto (protótipo)

Jogo de mundo aberto no navegador, gerado a partir de dados reais do OpenStreetMap.
Área: do Recife Antigo e da Boa Vista aos morros da zona norte (Morro da Conceição, Alto José do Pinho, Vasco da Gama…), passando por Graças, Casa Forte e Poço da Panela, até Boa Viagem e o aeroporto (~7,8 × 15,5 km, ~88 mil prédios).

```bash
npm install
npm run dev        # http://localhost:5188
npm run dev -- --host   # para abrir no celular pela rede local
npm run places     # baixa só escolas, museus, shoppings, restaurantes etc. e junta ao mapa
node scripts/fetch-osm.mjs --norte=-8.005   # baixa só uma faixa ao norte e junta ao mapa (assim entraram as Graças e os morros)
npm run data       # baixa de novo os dados do OSM (Overpass) → public/data/recife.json
```

## Como funciona
- `scripts/fetch-osm.mjs`: baixa ruas, prédios, água, costa, praças, molhes e POIs e projeta tudo em metros.
- `src/world.js`: rasteriza o mapa em blocos (grade de colisão de 1,5 m) para gerar o chão, a água e a colisão. O mar sai da linha de costa por votação de regiões, e as praias viram areia firme. Extruda os prédios, com espigões na orla de Boa Viagem e do Pina quando o OSM não tem altura, e monta as ruas, as pontes e a pista do aeroporto. Os quarteirões fora da neblina ficam escondidos.
- `src/photos.js` + `public/textures/`: 9 texturas fotográficas CC0 do [Poly Haven](https://polyhaven.com), com cor e relevo (6,7 MB, créditos em `public/textures/CREDITS.md`):
  - asfalto das ruas;
  - placas de calçada e paralelepípedo do Recife Antigo;
  - grama e areia da praia;
  - reboco das fachadas;
  - telha de barro dos sobrados e laje dos prédios;
  - casca das árvores.

  Tudo é amostrado em coordenadas do mundo, para não esticar nem repetir por rua ou janela. A cor de cada lugar vem do mapa do OSM; a foto dá o detalhe. Se alguma imagem falhar, entra uma textura neutra.
- `src/textures.js`: o que não veio de foto é gerado por código, também com mapa de relevo:
  - fachadas em atlas: 4 variantes por tipo, com o térreo diferente dos outros andares. Sobrado com venezianas, sacada de ferro e porta de aço; prédio com janela de alumínio, pastilha e ar-condicionado; torre com varanda de vidro e grade no térreo;
  - faixas pintadas e gastas, sarjeta e trilho de pneu (por cima da foto do asfalto);
  - folhagem das árvores e manchas de sujeira.
- `src/trees.js`: ~48 mil árvores (oitis, mangueiras e flamboyants) nas calçadas e praças, em instâncias por bloco de 800 m. Aparecem até ~1,4 km, o tronco tem colisão e a copa balança com o vento. Para testar sem elas, abra a URL com `?notrees`.
- `src/landmarks.js`: marcos feitos à mão: rosa dos ventos do Marco Zero, Coluna de Cristal, Torre Malakoff, estátuas, Parque Dona Lindu, coqueiros da orla e placas de alerta de tubarão.
- `src/places.js`: placas nas fachadas de cerca de 940 lugares com nome no OSM:
  - escolas, faculdades, museus, hospitais, bibliotecas, cinemas, teatros, restaurantes, bares, cafés e lanchonetes;
  - cada tipo tem cor e ícone próprios; restaurantes, bares e cafés ganham toldo;
  - letreiro grande no alto dos shoppings;
  - letreiros próprios para Restaurante Leite, Parraxaxá, Chica Pitanga, Bargaço, Tasca, Entre Amigos o Bode, Paço do Frevo e Cais do Sertão.

  As placas ficam em atlas de texto (uma chamada de desenho por atlas) e acendem à noite.
- **Boa Vista:**
  - Rua da Aurora com casario colorido de frente para o Capibaribe, o Caranguejo gigante e o Obelisco;
  - comércio de rua com placas e toldos na Rua da Imperatriz, na Rua Nova, na Conde da Boa Vista, na Rua do Hospício e na Sete de Setembro;
  - chafariz monumental na Praça Maciel Pinheiro e estátua do Conde da Boa Vista;
  - Faculdade de Direito (com cúpula), Assembleia Legislativa, Igreja da Soledade, Ginásio Pernambucano e Cinema São Luiz.
- **Graças e arredores** (faixa norte baixada à parte, com a mesma projeção):
  - Estádio dos Aflitos (Náutico), com gramado, arquibancadas vermelhas e brancas, cobertura e refletores que acendem à noite;
  - Museu do Estado de Pernambuco (palacete neoclássico);
  - Igreja das Graças, Matriz de Casa Forte e Igreja da Torre;
  - a capela amarela dentro do Parque da Jaqueira;
  - placas no Colégio Damas, no Marista São Luís, no Museu do Homem do Nordeste e nos hospitais;
  - Shopping Tacaruna, Plaza e Parnamirim com letreiro.
- **Casa Forte e Poço da Panela:**
  - Praça de Casa Forte, o jardim de Burle Marx: espelho d'água retangular e lagos redondos com vitórias-régias, e alamedas de palmeiras imperiais (fora das ruas);
  - Poço da Panela: Igreja de Nossa Senhora da Saúde de frente para o largo, mangueiras enormes, bancos e postes coloniais, ruas de paralelepípedo e casario térreo colorido;
- **Casario gerado** (`infillHouses` em `src/places.js`): o OSM não tem o contorno das casas em boa parte da zona oeste e norte.
  - Ao carregar, o jogo mede quanto das ruas residenciais de cada bairro tem prédio num raio de 18 m.
  - Abaixo de 60%, cria lotes ao longo dessas ruas, só onde não há prédio, rua, água nem praça. Hoje são cerca de 32 mil casas em 26 bairros: San Martin, Cordeiro, Afogados, Mangueira, Mustardinha, Zumbi, Bongi, Torre, Madalena e outros.
  - Três estilos:
    - histórico (Poço da Panela, Casa Forte): casario térreo colorido com telha;
    - popular (Mustardinha, San Martin, Bongi, Afogados…): casas estreitas e coladas, laje com caixa d'água azul, reboco cru ou tijolo;
    - classe média: casas soltas e alguns prediozinhos.
  - Fachada própria "casa": janela com grade, porta de aço, portão gradeado, varandinha e mercadinho.
  - As casas entram na colisão e no minimapa. Se o OSM melhorar, o preenchimento diminui sozinho.
- **Zona oeste e norte** (`buildBairros` em `src/classics.js`):
  - Torre do Zeppelin no Jiquiá: treliça de aço com luz no topo, a única torre de atracação de zepelim que resta;
  - estádio do Sport (Ilha do Retiro), com arquibancadas vermelhas e pretas;
  - Mirabilândia em Campo Grande: roda-gigante e carrossel girando, barco pirata balançando e tobogã;
  - Parque de Exposições do Cordeiro com galpões de feira e o Cavalo Branco; o Cavalo Dourado no Prado;
  - Arraial Novo do Bom Jesus (forte de terra com baluartes);
  - Jardim do Baobá e a Chaminé do Engenho da Torre;
  - Museu da Abolição; Paróquia da Madalena, Igreja Santa Edwirges e Nossa Senhora de Fátima;
  - mercados da Torre, Encruzilhada, Afogados e Cordeiro, e o Clube Vassourinhas, com placa;
  - comércio de rua com placa e toldo na Caxangá, Abdias de Carvalho, General San Martin, Estrada dos Remédios, Real da Torre, José Rufino, Avenida Norte, Rosa e Silva e Beberibe.
- **Comunidades** (`src/culture.js`), começando por Brasília Teimosa e Coque, mostradas pela cultura e pela vida de rua:
  - casario autoconstruído com fachada própria: reboco pintado, tijolo aparente, casa meio-acabada (reboco embaixo, tijolo em cima), muro grafitado, grade azul, laje com caixa d'água;
  - paredão de brega com caixas empilhadas e LEDs que piscam no tempo, DJ e galera dançando;
  - roda de passinho com plateia batendo palma e dois dançarinos. Com **G** (ou o botão de ação no celular) você entra na roda e a galera solta uns trocados;
  - terreiro de umbanda (casa branca e azul, bandeirolas, atabaques e quartinha na porta); à noite ouvem-se os atabaques;
  - campo de pelada de terra com a molecada jogando;
  - em Brasília Teimosa, jangadas na areia e oferendas a Iemanjá (flores, barquinhos e velas);
  - **Ilha de Deus** (`buildIsland` em `src/culture.js`). A área é a própria ilha: a terra ligada ao ponto do OSM, sem atravessar água.
    - casario de comunidade;
    - palafitas coloridas sobre estacas, com varal e passarela de tábuas (dá para andar até a porta), todas juntas em poucas malhas;
    - mangue com raízes-escora nas margens;
    - canoas balançando, algumas com pescador remando;
    - marisqueiras catando sururu com o balaio;
    - pescadores de linha na ponte;
    - estacas nos viveiros de camarão;
    - roda de ciranda girando de mãos dadas e o Centro de Artes Ilha de Deus;
    - o HUD mostra "Ilha de Deus" como bairro.
  - som em `src/audio.js`: batidas originais geradas no jogo (brega-funk a 150 BPM, atabaques rum, rumpi e lé, e ciranda a 92 BPM com zabumba, ganzá e melodia pentatônica), com volume pela distância. Nenhuma música real é usada.
- **Morros da zona norte** (`src/terrain.js` e `buildMorro` em `src/culture.js`):
  - **Relevo:** a cidade é plana, mas 12 morros ganharam altura. Morro da Conceição (~72 m, com o topo na estátua), Alto José Bonifácio, Alto Nossa Senhora de Fátima, Vasco da Gama, Alto Santa Teresinha, Alto José do Pinho, Alto do Mandu, Bolo de Noiva, Linha do Tiro, Córrego do Botijão, Macaxeira e Bomba do Hemetério.
    - Cada um é um platô com encosta íngreme e contorno irregular. As alturas são aproximadas, porque o OSM não tem altitude.
    - `heightAt(x, z)` é usado pelo chão (malha de 4 m), pelas ruas (pontos a cada 5 m), pelos prédios (a parede desce até o ponto mais baixo do lote), pelos postes, árvores, placas e cultura, pela câmera e por carros e pessoas. Os carros inclinam na ladeira.
  - **Casario autoconstruído** nos morros, tanto nos prédios do OSM quanto no casario gerado.
  - **Morro da Conceição:** estátua de Nossa Senhora da Conceição no topo (manto azul, coroa dourada), santuário ao lado e bandeirolas azuis e brancas da Festa do Morro em todas as ruas num raio de 260 m.
  - **Alto José do Pinho:** palco com letreiro, luzes no tempo da música, banda (bateria, guitarra, baixo e voz) e a galera na frente.
  - **Nos dois:** paredão de brega, roda de passinho, terreiro e campo de pelada.
  - **Escadarias** (`buildStairs` em `src/world.js`): as 269 escadarias do OSM nos morros (~23 km) viram escada de verdade.
    - Um degrau a cada 0,6 m seguindo o terreno, com espelho pintado (cada escadaria com sua sequência de cores) e corrimão dos dois lados.
    - Tudo numa malha só (~395 mil vértices).
    - Dá para subir a pé; carro e viatura não passam (as células da escada são marcadas na grade).
- **Prédios famosos:** Edifício Holiday (52 m), Cais do Sertão (caixa de cobogó), Shopping Recife e Shopping Boa Vista.
- `src/classics.js`: os pontos clássicos, no lugar e com o contorno do OSM (o prédio genérico dá lugar ao modelo):
  - **Igrejas barrocas** (frontão com volutas, torres com coruchéu, óculo, porta em arco): Madre de Deus, Carmo, São Pedro dos Clérigos, Santo Antônio, Livramento, Rosário dos Pretos, Conceição dos Militares, Espírito Santo, São José, Santa Rita, Pilar, Terço, Santa Cruz e outras. A Basílica da Penha tem cúpula.
  - **Neoclássicos** com pórtico de colunas e frontão: Teatro de Santa Isabel, Palácio do Campo das Princesas, Estação Central, Ginásio Pernambucano e Palácio da Justiça (com cúpula).
  - **Mercado de São José** (ferro verde e lanternim), **Casa da Cultura** (planta em cruz com torre central), **Forte das Cinco Pontas** e **Forte do Brum** (muralhas inclinadas e baluartes).
  - **Cinema São Luiz** com letreiro vertical em neon. Pontes com guarda-corpo; a da Boa Vista com treliça de ferro e a Maurício de Nassau com estátuas de bronze nas cabeceiras.
  - **Praças e ruas:** chafariz na Praça do Arsenal; bandeirinhas e mesinhas com guarda-sol na Rua do Bom Jesus; Bonecos Gigantes de Olinda na porta da Embaixada; esculturas do Parque Francisco Brennand no Dique do Recife.
  - **Boa Viagem:** barracas de coco, guarda-sóis com cadeiras, jangadas na beira-mar e a Igreja de Nossa Senhora da Boa Viagem na pracinha, de frente para o mar.
- `src/models.js`: veículos e pessoas feitos por código.
  - **Carros:** três carrocerias (hatch, sedã e SUV), cada uma recortada a partir de um perfil lateral, com caixa de roda e vidro que reflete. Detalhes: frestas das portas, maçanetas e frisos cromados, grade, saia lateral, para-lamas, retrovisores e placa Mercosul. As peças de cada tipo são montadas uma vez só, o que dá poucas chamadas de desenho por carro.
  - **Motos:** com piloto de capacete; metade é motoboy com baú. Inclinam na curva. Se você pega uma, vira o piloto; estacionada, fica vazia.
  - **Pessoas:** corpo com contornos torneados (peito, cintura, coxa, panturrilha); rosto com olhos, sobrancelhas, orelhas, nariz e boca; cinco cabelos (curto, raspado, cacheado, comprido e coque); jeans com textura de sarja; tênis com sola branca; moletom com capuz e bolso. Altura e porte variam. O jogador usa moletom cinza, calça escura e tênis branco, no estilo da referência. Joelho e cotovelo são articulados, e o andar dobra a perna que vem para frente.
- `src/traffic.js`: grafo de ruas com carros e ônibus que respeitam mão única, e pedestres que falam pernambuquês.
- `src/police.js`: procurado de 1 a 5 estrelas. Roubar carro com motorista, atropelar ou bater na viatura dá estrela. As viaturas da PM perseguem pelas ruas, com rota pelo grafo (Dijkstra) e perseguição direta quando te avistam. Parar perto de uma viatura dá "PRESO!". Ficar uns 10 a 25 s fora de vista despista a polícia.
- `src/missions.js`: celular de bicos (tecla **P**). Três tipos:
  - **OxeCar**: corrida de app. Busca o passageiro e leva ao destino. Batidas tiram gorjeta, e se a polícia aparecer, o passageiro pula fora.
  - **Tapioca Já**: entrega. Pega o pedido num mercado ou shopping e entrega no endereço.
  - **Racha**: corrida ilegal com pontos de controle do Pina até o fim de Boa Viagem. Dá 1 estrela.

  Ser preso cancela o bico e cobra 10% de fiança.
- `src/phone.js` + `src/shop.js`: celular com abas (**Q/E** troca de aba, **1–9** escolhe):
  - **Garagem (Auto Oxe):** carro popular, SUV, buggy de praia e esportivo. O carro comprado chega onde tu estiver e não gera estrela.
  - **Loja (Feira de São José):** camisas listradas (rubro-negra, alvirrubra, tricolor, frevo), boné, chapéu de cangaceiro, óculos e sombrinha de frevo.
  - **Serviços:** advogado (zera as estrelas), turbo (+20% nos teus carros), apê em Boa Viagem (onde tu volta depois de preso) e táxi pra casa.
- `src/save.js`: dinheiro, compras e roupa ficam salvos no navegador (`localStorage`, chave `oxecity.save.v1`).
- Visual: o vidro reflete o céu. A iluminação usa uma versão do céu menos saturada e com chão quente embaixo, para as sombras não ficarem azuis. No computador há oclusão de ambiente (GTAO), que escurece cantos e o pé das paredes. Uma correção de cor dá mais contraste, tom quente e vinheta. À noite cada janela sorteia se está acesa.
- `src/daynight.js`: dia de jogo com o sol na trajetória real do Recife em novembro (1 hora de jogo = 1 minuto real).
  - **Sem noite**: o relógio vai das 6h às 17h05 e volta ao amanhecer, então nunca escurece. **T** adianta 2 h.
  - O céu é um shader próprio, com paleta por altura do sol, halo e disco do sol.
  - As nuvens se movem e são iluminadas conforme a hora.
  - A neblina segue a cor do horizonte, e há bloom no sol.
  - O código da noite (janelas, postes, faróis, estrelas) continua lá, só não é mais usado.
- `src/touch.js`: controles de toque. Liga sozinho em celular e tablet (ou com `?touch=1` na URL, para testar no computador):
  - joystick que nasce onde o polegar esquerdo encosta (anda, ou acelera, freia e vira no carro, de forma analógica);
  - arrastar no lado direito gira a câmera;
  - botões 🚗 entrar/roubar/sair, 🏃 correr, ✋ freio de mão e 📯 buzina (só aparecem os que servem na hora);
  - no topo, 📱 celular, 🗺️ mapa e ⏩ adiantar o relógio.

  O HUD se reorganiza para não ficar embaixo dos polegares, em pé ou deitado. No celular a resolução é limitada a 1,5× para render melhor.
- `src/hud.js`: nome da rua, ponto turístico próximo, minimapa e mapa com teletransporte.

## Controles
- **WASD ou setas**: andar a pé e dirigir.
- **Espaço**: pular a pé. No carro continua sendo o freio de mão.
- **G**: passinho em qualquer lugar.
  - Os passos se alternam sozinhos a cada 8 tempos: Tesourinha, Caranguejo, Quebradeira, Giro, Cruzado, Trava e Pulinho.
  - O brega toca enquanto o personagem dança.
  - Numa roda de passinho de comunidade, a galera ainda joga trocados.
- **F**: entrar no carro ou no barco.
- No celular há botões de pular (⤴️) e de passinho (🕺).
- **N**: GPS (`src/gps.js`). **Shift+N** cancela a rota, e **Shift+clique** no mapa (M) traça a rota até o ponto.
  - Também acha endereço de verdade (rua e número): a busca local vem junto com a do Nominatim (geocodificação do OpenStreetMap, gratuita e sem chave), limitada ao retângulo do mapa, com no máximo 1 consulta por segundo. Sem internet, fica só a busca local.
  - Ao chegar (a menos de 18 m), aparece o aviso "📍 Chegou em …!" com o botão "Escolher novo destino".
  - Depois de 10 s sem digitar nada, o painel some e vira um botão embaixo da tela ("Pra onde, boy?", ou o destino atual com "trocar destino"). Clicando nele, o painel abre de novo.
  - Busca lugares e bairros sem precisar de acento e escolhe com Enter ou clique.
  - A rota sai pelo grafo de ruas, com A* na malha principal. De carro respeita a mão única e só usa contramão como último recurso.
  - Setas azuis aparecem no chão nos próximos ~200 m, o painel de cima mostra a próxima manobra com distância, nome da rua e tempo, e a rota fica em azul no minimapa.
  - Se o jogador sai mais de 28 m da rota, ou entra e sai do carro, a rota é recalculada. Perto do destino, avisa que chegou.
- **R**: rádio 8-bit (`audio.js`). A sequência é desligada, Rádio Frevo, Rádio Mangue Bit, Rádio Brega e desligada de novo.
  - As faixas são composições próprias no clima de cada ritmo, não transcrições de músicas existentes.
  - O som é de console antigo: melodia em onda quadrada, baixo em triângulo e bateria de ruído.
- Embaixo da tela, ao lado do botão do GPS, fica o botão da rádio. Ele mostra a estação que está tocando (ou "Rádio desligada") e abre a lista para escolher Frevo, Mangue Bit ou Brega, ou desligar.
- **U**: mudo. O botão 🔊/🔇 fica ao lado do botão da rádio (no celular, na barra de cima), e a escolha fica guardada no navegador (`localStorage`).
- **K**: foto da cena sem HUD (PNG com bairro e hora).
- **B**: compra do ambulante no sinal (de carro) ou dos vendedores da praia, da feira e do catador de caranguejo (a pé).
- No celular há também os botões 🧭 (GPS) e 📻 (rádio).
- **Falas**: o povo fala com gíria de Recife, a partir do dicionário recifense: "caraí", "visse", "boyzinha", "é o ouro", "ei, bença!", "lá ele", "meu rato", "peso", "postura", "lusa", "de rosca", "arrodeia", "faz o balão", "catabiu", "chapoletada", "pala de botico", "aí dento", "dispense", "já tô chegando" (ir embora).
  - Também há falas de comida (caldinho, arrumadinho, cartola, bolo de rolo, mungunzá), de futebol (Trio de Ferro, secar, pipocar, peba, baba) e de carnaval (brincar, furdunço, troça, La Ursa, Zé Pereira, apoteose, bacurau).
  - Tem falas da comunidade, da classe média e de todo canto. "Égua" saiu, porque não é daqui.

## Motos, bikes e colisão
- **Trânsito**: cerca de 26% são motos (metade de motoboy com baú) e 10% bikes de entregador com bag térmica nas costas.
  - As bikes andam no canto da pista a até 6,5 m/s, e os carros passam do lado.
- **Estacionadas**: cerca de 10 motos e bikes ficam paradas no meio-fio em volta do jogador.
  - **F** pega (ou rouba, se tiver alguém pilotando no trânsito).
  - Na bike não tem barulho de motor e as pernas pedalam com a roda.
- **Colisão sem travar**: em vez de "livre ou bloqueado", cada posição tem um custo (quanto está dentro de parede, gente ou carro).
  - Encostado ou preso, qualquer movimento que não piore é aceito, então dá sempre pra sair de ré ou de lado.
  - Se ficar preso mais de 1,2 s, o jogo põe o personagem (ou o carro) no lugar livre mais perto, até 40 m.
- **Postes**: em quase todas as ruas, mais juntos nas avenidas, e nas pontes e viadutos sem lampião próprio.

## Recife Antigo: marcos
- **Paço do Frevo, Paço Alfândega e Caixa Cultural** viram prédios ecléticos modelados.
  - O Paço do Frevo tem sombrinhas de frevo gigantes na fachada e no telhado.
- **Palácio do Campo das Princesas**: jardim com palmeiras imperiais e as bandeiras do Brasil e de Pernambuco.
- **Prefeitura do Recife**: bandeiras na frente e letreiro no alto.
- **Porto Digital, CESAR e CESAR School**: letreiros.
- **Praça do Arsenal**: feirinha de artesanato com barracas coloridas em volta da Torre Malakoff.
- **Dokas** (Rua do Brum, 27-A, 1º andar): a casa de show de punk, hardcore e metal do Recife Antigo, num sobrado de térreo e primeiro andar logo no começo da Rua do Brum.
  - Lá em cima, pelos três janelões, rola o show: banda no palco (vocal, duas guitarras e bateria) batendo cabeça, galera pulando, luzes piscando a 180 BPM.
  - Embaixo, lambe-lambes no térreo, segurança na porta e fila de punks na calçada, alguns de moicano.
  - Perto dele dá para ouvir um punk rock próprio, sintetizado e abafado pelas paredes.
- **Já existiam**: Cinema São Luiz com o letreiro em neon, Teatro Santa Isabel, Cais do Sertão, Praça de Casa Forte, e letreiros de colégios, cinemas e shoppings.

## Lugares pedidos (`src/lugares.js`)
- **Arruda (Estádio José do Rêgo Maciel, Santa Cruz)**:
  - tigela oval de concreto com a arquibancada inferior inteira e o anel superior em três quartos do estádio;
  - setores em vermelho, branco e preto, gramado com as linhas do campo e quatro torres de refletores;
  - colisão só no anel (o campo fica livre).
- **Colégios** (Damas, Marista São Luís, Agnes, Boa Viagem nas duas unidades, Santa Maria, NAP e Apoio): portal com o nome, mastros com as bandeiras do Brasil e de Pernambuco e a bandeira do colégio.
  - O NAP (Praça de Casa Forte, 52) e o Apoio (Rua Conselheiro Nabuco, 44) não estão no OSM; a posição é aproximada pelo endereço.
  - O terreno do Damas está vazio no OSM. O jogo levanta ali um campus: prédio em U de três andares, pátio e quadra coberta.
  - As cores de cada colégio são aproximadas.
- **Parque da Jaqueira**: além da capela barroca, uma pista de caminhada de saibro acompanhando o contorno do parque e quiosques.
- **Cais do Sertão** (Brasil Arquitetura, antigo Armazém 10): concreto pigmentado ocre, cor do chão do agreste, coberto por uma "renda" branca de concreto vazado.

## Boemia e comida de rua (`src/boemia.js`)
O ponto vem do OSM quando existe. Senão, vem da rua do endereço, e a posição na rua é aproximada.
- **Botecos**: cada um tem placa na fachada, toldo listrado, mesas de plástico na calçada com gente sentada e, quando é o caso, roda de chorinho, samba ou forró, ou fila na porta.
  - Bodega de Véio, Boteco da Moeda, Bar Zero Um e Teatro Mamulengo (Recife Antigo).
  - Lisbela e Prisioneiros (com vitrola), Bar do Tonhão, Real Botequim, Boteco do Bêu e Tatu Bola.
  - O Parraxaxá ganhou cactos e uma roda de carro de boi na entrada.
- **Chico Science** em bronze na Rua da Moeda, de chapéu e óculos escuros, no lugar do boneco genérico.
- **Frevo na Praça do Arsenal**: orquestra de metais e passistas com sombrinha fazendo o passo.
- **Pracinha de Boa Viagem**: barracas de tapioca molhada e caldinho e a feirinha de artesanato. Mais ao norte, na orla, fica o quiosque da Tapioca Rendada do Damião.
- **Rua Nova**: barracas de fruta e roupa e um artista de rua com caixa de som.
- **Parque da Rua da Aurora**: feirinha e skatistas.
- **Lagoa do Araçá**: barracas de espetinho e caldinho na volta da lagoa.
- **Brasília Teimosa (Buraco da Velha)**: barracas de peixe frito e agulhinha na areia.
- O Instituto Ricardo Brennand e a Oficina Brennand ficam na Várzea, fora da área do mapa.

## Tubarão de Boa Viagem (`src/tubarao.js`)
- Dá para entrar no mar da orla nadando, mais devagar. Placas amarelas de "área sujeita a ataque de tubarão" ficam na areia a cada ~350 m.
- Depois de 3 s na água aparece a barbatana, o tubarão chega e dá o bote, e a tela mostra **"VACILOU, BOY!"**.
- "Bora de novo" (ou Enter) põe o jogador de volta na areia.

## Recife inteiro (mapa padrão)
O jogo abre no município inteiro (`public/data/recife-full.json`). O recorte antigo (`public/data/recife.json`, centro, zona norte e zona sul até Boa Viagem), mais leve, abre com `?mapa=antigo` na URL.
- **Como gerar**: os servidores públicos do Overpass estavam sobrecarregados, então os dados saem do extrato do Nordeste da Geofabrik (`nordeste-latest.osm.pbf`, ~446 MB, fora do projeto).
  1. Recorte do retângulo do município, com o `pyosmium`:
     ```bash
     python3 scripts/pbf-para-overpass.py nordeste.osm.pbf data/raw-recife.json -8.1582 -35.0216 -7.9260 -34.8485
     ```
     Guarda só o que a consulta antiga pedia, no mesmo JSON do Overpass "out geom". Leva uns 2 min.
  2. Junta ao mapa antigo:
     ```bash
     node scripts/fetch-osm.mjs --recife --cache
     ```
     Mantém a mesma projeção (as posições postas à mão continuam valendo), ignora o que já estava no mapa e só aceita o que fica dentro do limite oficial do Recife. O limite (OSM, `admin_level` 8) vai para `data/recife-limite.json` e, em metros do jogo, para `meta.limit`. A Cohab, que não tem ponto de bairro no OSM, entra pela posição pesquisada.
  - Sem `--cache`, o script tenta o Overpass em pedaços de 0,02°.
- **Resultado**: +53 mil prédios, +10,7 mil vias, +540 lugares, 145 bairros e 23 MB. Todos os 94 bairros oficiais estão no mapa (Várzea, Iputinga, Caxangá, Cidade Universitária, Ibura, Jordão, Nova Descoberta, Guabiraba…).
- **Relevo** (`terrain.js`): uma grade por grupo de morros vizinhos, com os morros novos (Nova Descoberta, Passarinho, Dois Unidos, Brejos, Guabiraba, Córrego do Jenipapo, Pau-Ferro, Dois Irmãos, Sítio dos Pintos, Ibura, Jordão, Cohab).
- **Comunidades dos bairros novos**: Roda de Fogo (Torrões), Detran (Iputinga), UR-7 (Várzea), Ibura, Jordão, Nova Descoberta, Passarinho, Dois Unidos, Brejo de Beberibe, Córrego do Jenipapo e Cohab.
- **Morros habitados** (`infill.js`): dentro dos morros de `HILLS` (menos os de mata: Guabiraba, Dois Irmãos, Pau-Ferro e Sítio dos Pintos) entra casario de comunidade sem exigir vizinhança densa: casinhas de 1 a 3 andares, coloridas, com caixa d'água, alinhadas com a rua, escadaria ou beco mais perto, e uma folga de ~12% para quintal. O que o passe da beira da rua já tinha posto lá também vira casa de comunidade. São ~12 mil casas (Passarinho foi de 1 para ~1.750 num raio de 400 m).
- **Instituto Ricardo Brennand** (`marcos.js`, `buildBrennand`): o Castelo São João de pedra ocre, com torres quadradas ameadas, a torre de menagem com guarita, janelas ogivais, portão em arco e o letreiro; a Pinacoteca no mesmo estilo; a alameda de palmeiras imperiais, esculturas de bronze e mata em volta. Num raio de 260 m não entra casario gerado.
- **Teste jogando** (do Marco Zero a 20 bairros, de carro e a pé): todas as rotas do GPS existem e saem em menos de 0,1 s; nos bairros novos há trânsito, gente, carros parados, caramelos e corridas, e o jogador e as casas acompanham o relevo dos morros. Ajustes:
  - O GPS também dá "Chegou" no fim da rota na rua: o centro de bairro do OSM às vezes cai longe de qualquer rua (Várzea, 700 m; Curado, 560 m).
  - O racha da beira-mar só aparece no celular a até 4 km da pista (antes aparecia em Passarinho, a 13 km).
- **Estado**:
  - O interior novo já é terra e o chão dos bairros novos já é cinza urbano (`world.js`).
  - O carregamento leva ~11–12 s, contra ~7,5 s no mapa antigo (a medição de ~40 s era a máquina carregada). A memória fica em ~1,3 GB.

## Mata e bairro onde o satélite mostra (cobertura do solo)
Começando o jogo na Várzea, aparecia um piso cinza vazio no lugar do **Refúgio de Vida Silvestre Mata São João da Várzea**. O OSM tem essa mata, mas desenhada como relação, e o extrator só trazia relações de prédio e de água.
- **Matas do OSM** (`scripts/matas.py`): tira do extrato da Geofabrik todas as áreas `natural=wood/scrub` e `landuse=forest`, inclusive as relações, e grava em `matas` (e em `parks` como verde) nos dois mapas. São 1.599 áreas.
  ```bash
  python3 scripts/matas.py nordeste.osm.pbf public/data/recife-full.json public/data/recife.json
  ```
- **Cobertura do solo** (`scripts/cobertura.py`, `src/cobertura.js`): ESA WorldCover 2021, 10 m, CC BY 4.0. Diz, a cada ~9 m, se ali é árvore, construído, campo, água, brejo ou mangue. O recorte de cada mapa vai para `public/data/<mapa>-cobertura.bin` (0,9 MB no Recife inteiro) e chega junto com o mapa. `?semcobertura` desliga.
  ```bash
  python3 scripts/cobertura.py ESA_WorldCover_10m_2021_v200_S09W036_Map.tif public/data/recife-full.json public/data/recife-full-cobertura.bin
  ```
  - **Mata**: copas largas a cada ~13 m onde a cobertura é árvore em pelo menos 60% da vizinhança (árvore solta de rua não vira mata), e mangue onde ela diz mangue. São até 400 mil árvores, em blocos de 800 m que só aparecem perto da câmera, acompanhando o relevo.
  - **Árvores de quintal**: onde a cobertura diz árvore, no lugar do palpite por densidade.
  - **Lotes**: a beira da rua não recebe casa gerada no meio da mata, do brejo ou do mangue.
  - **Bairro sem casa no OSM**: onde a cobertura diz construído e o OSM e a Microsoft quase não têm prédio, entra casario baixo e colado (~41 mil casas), só dentro do município.
- **Comparação com o satélite** (Esri World Imagery, 225 quadrados de 1 km do município, só para medir): os quadrados com mata no satélite e chão vazio no jogo caíram de 75 para 2. A semelhança do verde entre o jogo e o satélite foi de −0,13 para 0,93 (correlação). O construído já batia bem com os prédios da Microsoft (0,83). Os quadrados ainda ralos (Jordão Alto, UR-10, Monte Verde) ficam na divisa com Jaboatão, e o que o satélite mostra ali é, em boa parte, fora do Recife.
- **Custo**: o carregamento ficou em ~15–17 s e a memória em ~1,9 GB.

## Marcos dos bairros novos (fotos do Wikimedia Commons)
- **Oficina Francisco Brennand** (Várzea, `buildOficina` em `marcos.js`): muralhas de tijolo escuro ao longo do contorno, com pilastras, nichos em arco nas duas faces e uma escultura de cerâmica no alto de cada pilastra; pátio com totens e ovos de cerâmica; o Templo do Sacrifício com cúpula de azulejo azul e figura no topo; a Accademia em arcadas; palmeiras imperiais na entrada. Em volta, nada de casa gerada nem de caixa sem nome.
- **Aeroporto do Recife** (`buildAeroporto`): o salão de vidro escuro debaixo da cobertura branca curva em balanço, "RECIFE" na borda, treliças brancas em arco sobre a via de embarque, pontes de embarque do lado da pista e a torre de controle.
- **Matriz da Várzea** (catálogo de igrejas do `classics.js`): creme com frisos brancos, uma torre de agulha e frontão curvo. A torre fica à esquerda de quem olha a fachada, como na foto (`towerSide: -1` no catálogo; sem isso, igreja de torre única põe a torre à direita).
- **Sem foto boa, ficaram de fora**: UFPE (Reitoria, Concha Acústica) e a entrada do Parque Dois Irmãos. A mata do parque já vem da cobertura do solo.
- **Áreas sem casario** (`scripts/areas-sem-casario.py` → `semCasario`): estacionamentos, aeroporto, porto, indústria, comércio, ferrovia, quartel, cemitério e obras do OSM. A cobertura do solo chama asfalto de "construído", e o gerador tinha enchido de casas o estacionamento do aeroporto.
  ```bash
  python3 scripts/areas-sem-casario.py nordeste.osm.pbf public/data/recife-full.json public/data/recife.json
  ```

## Aflitos pela Rosa e Silva e árvores de parque
- **Entrada do Aflitos** (`estadios.js`): o estádio pode ter `gateRoad`, a rua para onde a entrada fica virada, em vez da rua de carro mais perto. No Aflitos é a Av. Conselheiro Rosa e Silva, como no satélite. A sede do Náutico (torre redonda, "CLUBE NÁUTICO CAPIBARIBE") fica na calçada da avenida, e a piscina do clube entre a sede e o estádio.
- **Árvores de parque** (`infill.js`): dentro de parques e praças do OSM que não são mata (Jaqueira, Tamarineira, 13 de Maio…), a copa que o WorldCover mostra vira árvores grandes soltas no gramado, cerca de 1 a cada 4, e não mata fechada.

## Teste de fumaça (`scripts/testar-tudo.mjs`)
Com o servidor de desenvolvimento no ar:

```bash
node scripts/testar-tudo.mjs
```

O script abre o jogo num Chrome sem janela (perfil novo, save vazio) e joga um pouco de cada coisa:
- anda a pé e dirige;
- faz uma corrida, uma entrega, um turismo, uma linha de ônibus e um mototáxi do começo ao fim;
- põe um ônibus na Conde da Boa Vista e confere que ele vai na faixa de dentro e para na estação;
- chama uma ambulância e confere que ela anda;
- monta uma blitz e passa devagar;
- chega perto de um bando de pombos e confere que voam;
- vira a hora perto de uma igreja e confere o sino;
- abre a feira de Casa Amarela de manhã, compra e confere que fecha de tarde;
- confere as jangadas navegando no mar;
- solta um avião e acompanha até pousar e sair da pista;
- monta o mangue perto da Ilha de Deus, compra do catador e confere que os caranguejos fogem;
- solta as pipas no Morro da Conceição, arrebenta uma linha e apara a pipa caída;
- assiste uma partida de dominó na praça e confere o troféu;
- assiste a roda de capoeira no Marco Zero e confere o som e o troféu;
- pesca com um pescador do cais (puxar cedo espanta, no tempo certo pega e vende);
- faz a Volta das Pontes da largada à chegada;
- assiste o mamulengo e os emboladores, joga moeda e confere o som do coco;
- curte o forró do Mercado da Boa Vista de tarde e confere que fecha de manhã;
- sobe num mirante, dá a volta com a câmera e confere que marcou;
- confere que um carro do trânsito virou carro de som;
- espera o ônibus numa estação do corredor, embarca, vai junto e desce na outra estação;
- monta a pelada e o frescobol na areia, confere que os meninos chutam e que o chute do jogador vira gol;
- aluga e devolve uma bicicleta compartilhada;
- para no sinal, vê o malabarista, dá a moeda e confere que ele vai embora;
- confere que o trânsito enche na hora do rush;
- calcula a rota do catamarã pela água, embarca, ouve o guia e chega no fim;
- desenha a agenda do celular e confere que escolher um item traça a rota no GPS;
- sorteia os desafios do dia, completa os três, confere o bônus e a troca no dia novo;
- monta um casamento na porta de uma igreja e confere que termina e conta;
- solta o caminhão de lixo com os garis;
- corta o cabelo numa barbearia e confere que o visual mudou;
- se inscreve na Corrida da Orla e corre os 2 km pelo calçadão até a chegada;
- entra no ensaio da quadrilha junina no Sítio da Trindade e acompanha as 8 figuras;
- faz a caçada às 10 Lendas do Recife inteira (dica do bairro, cada lenda achada, ranking e aba do celular);
- troca pelos 6 personagens (cartões da tela de início, save e boneco certo) e confere que o corte da barbearia zera;
- monta o Natal no Marco Zero (e confere que fora da época não monta) e tira foto com o Papai Noel;
- pega o isopor no quiosque de picolé e vende os 12 picolés pros banhistas da areia;
- pega um galão no depósito de Casa Amarela, confere que vai pro ombro, chega na freguesa e entrega (com pagamento);
- senta numa mesa de dominó, joga uma pedra clicando na tela, deixa a partida terminar e levanta da mesa;
- liga o toró com alagamento;
- passa pelo álbum, pelas oito abas do celular, pelo bloco de frevo e pelo som ambiente;
- para num sinal vermelho, espera o ambulante e compra;
- liga a rádio e confere o boletim;
- confere a torcida do dia de jogo;
- vai pra areia de Boa Viagem e compra de um vendedor;
- confere que o roteiro do primeiro dia foi marcando as tarefas;
- recebe e cumpre um pedido do Zap;
- faz a história da prima inteira (aeroporto, passeio, frevo e volta) , a do aniversário de Mainha e o roteiro gastronômico, e confere os troféus;
- tira uma foto com K (sem baixar) e confere o tamanho;
- compra a barraca de tapioca e confere o rendimento na virada da hora;
- confere o bairro do Brennand (Várzea) e abre e fecha o mapa.

Cada passo mostra ✓ ou ✗ com o que conferiu e quanto tempo levou. Qualquer erro de JS no console durante o passo conta como falha, e o script sai com código 1. Se a página recarregar no meio (outra sessão salvou um arquivo), a rodada é refeita, até 3 vezes. Leva uns 3 minutos, quase tudo na carga e na espera do sinal fechar.

## Negócios (aba Serviços, `src/negocios.js`)
Pra onde vai o dinheiro dos bicos: a aba Serviços vende três negócios que rendem a cada hora cheia do jogo.

| Negócio | Preço | Rende por hora |
|---|---|---|
| Carrinho de queijo coalho, na areia de Boa Viagem | R$ 800 | R$ 15 |
| Barraca de tapioca na orla | R$ 2.500 | R$ 45 |
| Bar no Recife Antigo, com mesa na calçada da Rua da Moeda | R$ 8.000 | R$ 150 |

A tela avisa ("💼 Teus negócios renderam R$ …"). Na virada do dia (17h → 6h) não paga. Ficam salvos em `save.negocios`; R$ 1.000 de rendimento dão o troféu "Empresário arretado".

## Recomeçar do zero (aba Serviços do celular)
O último item de Serviços é **Recomeçar do zero**. O primeiro toque só arma: o item vira "Tem certeza? Toca de novo" e lista o que vai ser apagado. Um segundo toque em até 8 s apaga o progresso e recarrega o jogo: dinheiro, carros, roupa, apê, álbum, troféus, roteiro e Zap.

`zerarSave()` em `save.js` remove o save do navegador e desliga o `persist` antes de recarregar, pra nada gravar por cima. Conferido num Chrome sem janela com um save de R$ 999: depois da confirmação, o jogo voltou com R$ 0 e nada guardado.

## Zap (`src/zap.js`, aba Zap do celular)
Gente da vida do jogador manda mensagem pedindo um favor, e cada favor usa uma parte do jogo:

| Quem manda | O que pede | Prêmio |
|---|---|---|
| Mainha | queijo coalho da praia | R$ 30 |
| Dona Socorro, a vizinha | comprar água do ambulante do sinal | R$ 20 |
| Primo Thiago | encontrar na porta do estádio em dia de jogo | R$ 30 |
| Prima Júlia, de SP | foto no Paço do Frevo | R$ 25 |
| Central do OXECAR | 3 corridas | R$ 60 |
| Kaline | brincar na troça | R$ 25 |
| Tia Cida, de Caruaru | avisar quando cair um toró | R$ 15 |
| Seu Biu | cobrir uma linha no BUSÃO | R$ 40 |
| Wellington | levar um turista no GUIA ARRETADO | R$ 35 |
| Prima Júlia | foto do castelo do Instituto Ricardo Brennand | R$ 30 |
| Mainha | 2 entregas no TAPIOCA JÁ | R$ 30 |
| Kaline | foto do Parque da Jaqueira | R$ 20 |
| Dona Socorro | mais 2 compras no sinal | R$ 25 |
| Seu Biu | rodar 5 km e contar como tá o trânsito | R$ 20 |
| Mainha | macaxeira da feira livre | R$ 25 |
| Vó | carona de Casa Forte pra missa na Igreja da Madre de Deus (bico ⭐) | R$ 30 |
| Painho | corda de caranguejo do catador do mangue | R$ 40 |

**História:** depois da foto do Paço do Frevo, a Prima Júlia avisa que está vindo pro Recife e pede pra ser buscada. Quando a mensagem chega, sai na hora um avião pra pousar nos Guararapes, o da prima. O pedido vira um bico ⭐ no topo da aba Bicos: buscar no Terminal Integrado do Aeroporto e levar até a Praça de Casa Forte, a casa de vó ("Vó já fez bolo de rolo!"). A corrida paga R$ 45 e o pedido mais R$ 50. A história continua em mais três passos, um liberado depois do outro:
1. **Passeio:** bico ⭐ da casa de vó, na Praça de Casa Forte, até o Marco Zero. R$ 40 da corrida e R$ 40 do pedido.
2. **Frevo:** brincar com ela na Troça Caraí Que Calor. R$ 35.
3. **Volta:** bico ⭐ de Casa Forte de volta pro aeroporto, "com as malas (e três bolos de rolo)". R$ 50 da corrida e R$ 80 do pedido.

No fim vem o troféu "Primo do ano" (R$ 100).

**Segunda história, o aniversário de Mainha** (começa depois do primeiro pedido de Mainha). Painho combina tudo em segredo:
1. **Vaquinha:** juntar R$ 300 pra festa. Ele pega o dinheiro sozinho quando tu tiver, porque o pedido aceita uma condição (`ok`) e um prêmio negativo.
2. **Bolo:** bico ⭐ pra buscar o bolo de rolo encomendado na Casa da Cultura e levar pra casa de vó, em Casa Forte ("Bolo de rolo no banco de trás. Devagar nas curvas!").
3. **Distrair Mainha:** bico ⭐ pra levar Mainha pra passear no Parque da Jaqueira ("Que passeio é esse do nada, menino? Tá aprontando, é?").
4. **A festa:** Mainha manda a mensagem da festa, com R$ 150 e o troféu "Filho de ouro" (R$ 100).

**Terceira história, o roteiro gastronômico do Wellington** (começa depois do pedido do amigo gringo). Ele faz blog de comida e precisa de motorista; são quatro bicos ⭐ encadeados:
1. Marco Zero → **Restaurante Leite**, que funciona desde 1882;
2. → **Bargaço**, no Pina ("Peixada com pirão... vou ter que dormir depois dessa");
3. → **Peixe frito do Buraco da Velha**, em Brasília Teimosa;
4. → **Tapioca Rendada do Damião**, na orla de Boa Viagem.

No fim, "o post bombou: 50 mil curtidas" e vem o troféu "Gourmet do Recife" (R$ 100). Passo de história liberado chega antes dos pedidos avulsos. O bico ⭐ fica na lista até ser feito, mesmo se a lista se renovar (`missions.fixas`, `offerHistoria`). Pedido com `depois` só chega depois de outro, e a história não se repete quando a lista recomeça.

São 29 pedidos (12 de histórias); quando todos são cumpridos, a lista recomeça (`save.zap.rodada`). Um pedido por vez. O primeiro chega uns 25 s depois de começar e os outros, 2 a 4 minutos depois do anterior cumprido. A mensagem aparece num aviso verde no canto de baixo e fica na aba Zap, que mostra o número de não lidas. Cumprir rende o prêmio, a resposta da pessoa e o cartão-postal.

Os pedidos são conferidos pelos mesmos contadores dos troféus (`onConta` em `trofeus.js`), e o da foto, pelo álbum. Tudo fica salvo em `save.zap`.

## Primeiro dia no Recife (`src/roteiro.js`)
No canto de cima à esquerda, uma lista curta ensina o jogo a quem chega. São sete tarefas:
1. andar um pouco;
2. entrar num carro;
3. abrir o celular;
4. fazer um bico;
5. tirar uma foto pro álbum;
6. ligar a rádio;
7. abrir o mapa.

Cada tarefa é marcada sozinha quando o jogo vê que foi feita, em qualquer ordem, com um ✔ na tela. As que faltam mostram a tecla. No fim aparece o cartão "Primeiro dia no Recife!" e caem R$ 50. O progresso fica no save (`save.roteiro`), e o ✕ fecha a lista de vez pra quem já conhece o jogo.

## Achar travada (`scripts/achar-trava.mjs`)
```bash
node scripts/achar-trava.mjs 5 60
```

Abre o jogo num Chrome sem janela, clica JOGAR, anda e testa a página a cada 2 s, quantas vezes pedir (aqui, 5 rodadas de 60 s). Se ela ficar 5 s sem responder, o script pausa o depurador e imprime a pilha: em que função e linha o JS está preso. Feito depois de duas travadas intermitentes na carga (parou em "Pendurando placas…") em 20/11. Em 8 rodadas seguidas não travou mais, e a causa não foi achada.

## Troféus (`src/trofeus.js`, aba Troféus do celular)
O jogo conta o que tu faz e guarda no save (`save.stats`): corridas, entregas, turistas, linhas de ônibus, passageiros, rachas, km dirigidos, fotos do álbum, desfiles em que brincou na troça, gente molhada na poça e torós enfrentados.

São 15 troféus. Cada um rende um prêmio uma vez só, de R$ 5 a R$ 250. Alguns exemplos:
- "Motô de fé": 10 corridas;
- "Guia arretado": 5 turistas;
- "Cem cabeças": 100 passageiros no busão;
- "Pneu careca": 100 km;
- "Frevo no pé": 5 desfiles da troça;
- "Tabacudo da poça": molhar 5 pessoas.

A aba Troféus mostra o que falta primeiro, com barra de progresso. O troféu ganho aparece no mesmo cartão-postal do álbum. Os cartões agora entram numa fila: o próximo espera o anterior sair (foto e troféu juntos não se atropelam). Para contar algo novo: `conta('chave', valor)`.

## Modo foto (tecla K)
**K** salva uma imagem da cena como está, sem HUD, minimapa ou letreiros, porque eles são HTML por cima do canvas. O arquivo é PNG com o nome do bairro e a hora: `hellcife-casa-forte-16h32.png`. A imagem é lida logo depois de o quadro ser desenhado (com o bloom), por `toBlob`, e a tela avisa "📸 Foto salva!". O teste de fumaça intercepta o download e confere que a imagem não veio vazia (~1,6 MB).

## Fidelidade: Rua do Bom Jesus e Ponte Maurício de Nassau (21/11, comparando com fotos)
- **Rua do Bom Jesus:** é paralelepípedo de parede a parede, sem calçada alta. O `pruneMarcos` marca a rua com `cobble`, então o chão vira pedra (`world.js`) e a montagem da calçada pula a rua (`rua.js`). Ainda sobra uma faixa lisa rente às fachadas, que vem da "calçada colada na fachada" do `rua.js` e não olha o `cobble`.
- **Ponte Maurício de Nassau:** os postes ornamentados agora ficam a cada 14 m (antes, 28 m). Os arcos baixos da ponte real não dá pra fazer do nosso lado: a pista fica em 0 e a água do rio em −0,7 m, então qualquer arco fica debaixo d'água. Teria que levantar a pista sobre o rio, e isso é do relevo das pistas. As estátuas das cabeceiras já existiam e aparecem.

## Fidelidade: orla de Boa Viagem e Jaqueira (21/11, segunda leva de fotos)
- **Casario gerado na orla (`infill.js`):** o casario monta o próprio índice da Av. Boa Viagem/Herculano Bandeira, porque o do `world.js` só existe depois. Na faixa de areia de Boa Viagem (até 150 m do lado do mar e do começo da avenida pro sul, z > −700; mais a leste e ao norte é Pina e Brasília Teimosa, que continuam com casa), do lado do mar da avenida (e até 8 m dela) não gera nada; a até 160 m, o lote cresce pra ≥ ~300 m² (16 × 19 m), e a regra de altura do `world.js` transforma isso em torre. A primeira fila agora é de torres. Os sobradinhos que ainda aparecem na areia vêm dos contornos da Microsoft/OSM, e não do casario gerado.
- **Árvores da orla (`trees.js`):** do lado do mar (até 150 m, z > −700, sem pegar Pina e Brasília Teimosa), no canteiro e na calçada da avenida (até 30 m pra dentro) não entra mais copa redonda nem flamboyant; lá ficam só os coqueiros do calçadão (`classics.js`).
- **Parque da Jaqueira (`buildMangue`):** a densidade agora é por parque. A Jaqueira mantém 85% da copa do satélite, quase mata fechada, como nas fotos; os outros parques continuam com 27% (árvore solta no gramado). Como os parques não têm nome no mapa, vale o polígono que contém o ponto do lugar.

## Bairro certo no HUD (`scripts/bairros-contorno.py`)
O HUD agora diz o bairro em que tu tá de verdade. Antes era o bairro de centro mais perto, que errava perto das divisas: o Instituto Ricardo Brennand, na Várzea, aparecia como Curado.

O script lê os contornos oficiais do OSM (boundary=administrative, admin_level=10). São 229 bairros, do Recife e dos vizinhos (Olinda, Paulista, Jaboatão, Camaragibe), simplificados a ~4 m e gravados como `bairrosArea` no mapa. O `hud.js` rasteriza tudo uma vez numa grade de 20 m (Uint8, ~2,8 MB) e a consulta é direta; fora de todos os contornos, volta ao centro mais perto.

**No mapa grande**, o nome de cada bairro fica no centro de área do contorno (antes ficava no ponto do OSM, às vezes na beira do bairro). Os maiores vêm primeiro, e o nome que encostaria noutro já escrito fica de fora; a letra cresce na proporção em que o mapa é reduzido na tela.

Conferido: Brennand e Oficina dão Várzea, UFPE dá Cidade Universitária, Sítio da Trindade dá Casa Amarela, Jaqueira dá Jaqueira. As dicas do Álbum usam o mesmo bairro.

## Bico de turismo: GUIA ARRETADO (`src/turismo.js`)
No celular, a aba Bicos agora tem uma quarta oferta: buscar um visitante perto de ti (de Caruaru, São Paulo, Lisboa, Alemanha…) e levar de carro até um marco que esteja a 1,2–7 km. São 21 destinos, achados pelo nome nos lugares do mapa: Marco Zero, Paço do Frevo, Bonecos Gigantes, Cais do Sertão, Kahal Zur Israel, Casa da Cultura, Santa Isabel, Capela Dourada, Madre de Deus, Cinco Pontas, Basílica do Sagrado Coração, 13 de Maio, Jaqueira, Praça de Casa Forte, Sítio da Trindade, Museu do Homem do Nordeste, Instituto Ricardo Brennand, Oficina Brennand, Dois Irmãos, UFPE e Guararapes. Um destino que o mapa não tem fica de fora.

No caminho, o turista pergunta coisas da cidade. Na chegada, o motorista conta em uma frase o que é o lugar. Paga mais que a corrida comum, perde por batida como a corrida, e o turista desiste se tu sair do carro.

## Álbum de lugares (`src/album.js`, aba Álbum do celular)
Os mesmos 21 marcos do turismo viram um álbum. Chegar perto de um deles (70 m; 150 m nos grandes, como Jaqueira, UFPE, Dois Irmãos, Brennand e Guararapes), a pé ou de carro, tira a foto: aparece o letreiro com o que é o lugar e tu ganha R$ 15. Fechar o álbum rende mais R$ 300. Quando dois marcos ficam colados (Paço do Frevo e Bonecos Gigantes), a segunda foto espera o letreiro da primeira sair.

A foto aparece como um cartão-postal marrom no alto da tela, que some sozinho em 8 s e não tapa o jogo.

**Placas de atrativo turístico:** cada marco ganhou uma placa marrom com letra branca, o padrão das placas de turismo do Brasil, na rua mais perto dele (20 dos 21; no Brennand e nos Guararapes, a placa fica na rua de acesso). A placa fica atravessada na calçada, legível nos dois sentidos, para quem passa reconhecer o lugar.

**No mapa:** os 21 lugares aparecem no mapa grande (M) como 📸, verdes quando já estão no álbum e cinzas quando faltam. Os que faltam também aparecem no minimapa quando estão perto. O bloco de frevo aparece como 🎺 amarelo nos dois mapas enquanto desfila. As marcas vêm de `hud.marcas()`, montado no `main.js`, e no mapa grande crescem na proporção em que o desenho é reduzido na tela.

Na aba Álbum, os lugares que faltam vêm primeiro, do mais perto pro mais longe, com o bairro. Escolher um (tecla 1–9 ou toque) fecha o celular e traça a rota do GPS até lá. O álbum fica salvo junto com o resto do progresso.

## Dia de jogo (`src/jogo.js`)
A cada dia do jogo (o relógio volta das 17h06 pras 6h), um estádio do Trio de Ferro tem partida das 14h às 17h, em rodízio: Sport na Ilha do Retiro, Náutico nos Aflitos e Santa Cruz no Arruda.

O que acontece no dia de jogo:
- **Torcida:** 60 torcedores com a camisa do time da casa (`makePerson({ top: 'time', time })`) ficam do lado do estádio virado pra avenida mais perto. Uns chegam andando, os outros pulam de braço pra cima, e 1 em cada 6 balança a bandeira listrada do clube. De vez em quando alguém grita ("Vamo, vamo, Sport!").
- **Som:** murmúrio de arquibancada com palmas no ritmo, ouvido a até ~700 m (`audio.torcida`).
- **Mapa e rádio:** ⚽ no mapa e no minimapa; a rádio anuncia o jogo e o trânsito perto do estádio.
- **Troféus:** chegar a menos de 140 m do estádio dá "Arquibancada" (1 dia) e "Trio de Ferro" (3 dias).

A torcida repara na camisa do jogador (as da loja do celular: rubro-negra, alvirrubra, tricolor). Com a do time da casa, alguém grita "Ê, rubro-negro! Chega mais, que hoje é nosso!" e vem o troféu "Torcedor de verdade"; com a de um rival, a zoeira é de boa ("Oxe, camisa do Náutico aqui? Corajoso, visse! 😂").

Torcida aqui é festa: canto, bandeira e pulo, sem briga. A torcida só é montada com a câmera a menos de 600 m e é desmontada no fim do jogo.

## Boletim da rádio (`src/boletim.js`)
Com a rádio ligada (R), o locutor dá uma notícia a cada 70–110 s, num letreiro verde de visor de rádio de carro acima dos botões. A primeira vem 8 s depois de ligar e dura 9 s na tela. A notícia sai do que está acontecendo no jogo:
- **toró**: avisa da chuva e diz uma rua com água acumulada, tirada das poças de verdade em volta;
- **depois do toró**: lembra que a água ainda não baixou perto dos canais;
- **troça**: por qual rua a Troça Caraí Que Calor está passando, se estiver desfilando;
- **hora e calor**: a hora do jogo e a temperatura (26 a 32 °C ao longo do dia; "Caraí, que calor!" a partir de 31);
- **trânsito**: inventado, numa das avenidas grandes;
- **recados**: bicos, ambulante, álbum ("ainda dá pra conhecer N cartões-postais").

Não repete a mesma notícia duas vezes seguidas.

## Vendedores na praia de Boa Viagem (`src/praia.js`)
Seis vendedores andam devagar pela areia, entre o calçadão e a água, num trecho de ~800 m em volta da câmera. A faixa de areia vai da Avenida Boa Viagem (`sharks.avX`) até a primeira água a leste. Quando o jogador passa a menos de 30 m, eles gritam o pregão.

O que vendem:
- **queijo coalho**, R$ 6, no fogareiro de lata com brasa e fumacinha que o vento leva pra terra ("Com mel de engenho ou orégano?");
- **picolé**, R$ 4, no isopor ("de coco, de graviola, de cajá");
- **castanha de caju**, R$ 5, e **amendoim cozido**, R$ 3, no balde.

A pé e a até 4 m de um deles, **B** compra; a dica embaixo da tela mostra o produto e o preço, e no toque o botão de ação vira "comprar". Comprar 3 vezes dá o troféu "Pé na areia". Longe da orla, os vendedores somem.

## Ambulante no sinal (`src/ambulantes.js`)
Parou o carro no semáforo vermelho (pelo `world.stopAhead`), e depois de ~1 s chega um ambulante pela janela. Ele vem de uns 7 m à frente, com a bandeja ou o isopor na mão, e grita o que vende:
- água mineral gelada, R$ 2;
- pipoca doce ou amendoim torradinho, R$ 3;
- chiclete, R$ 1;
- carregador de celular, R$ 10.

**B** compra; a dica embaixo da tela mostra o produto e o preço. Abriu o sinal ou o carro andou, ele diz "Vai com Deus, patrão!" e volta pra calçada. Entre um ambulante e outro passam pelo menos 25 s. Comprar 5 vezes dá o troféu "Freguês do sinal". Não vem pra bicicleta. No celular (toque), o botão de ação vira "comprar" enquanto o ambulante está na janela.

## Toró (`src/weather.js`)
De vez em quando cai um toró: a primeira chuva vem entre 4 e 8 minutos de jogo, dura de 1,5 a 3 minutos e depois estia por 5 a 10. A chuva engrossa e afina em alguns segundos, e a tela avisa quando chega e quando estia.

Durante a chuva:
- o céu fica cinza e o sol some;
- a luz direta, as sombras e o brilho caem;
- a neblina encurta;
- as nuvens fecham;
- a chuva faz barulho (ruído filtrado em `audio.rain`).

As gotas são 14 mil riscos numa caixa de 70 m em volta da câmera. Elas caem e dão a volta inteiramente no shader, sem mexer em vértice no JS. O efeito é aplicado logo depois de `day.update`, sobre o que o ciclo do dia acabou de calcular, então `daynight.js` não muda. Para testar: `game.weather.set(1)` faz chover e `game.weather.set(0)` estia.

**A chuva muda o jogo:**
- **Pista molhada:** o carro aponta pra um lado e segue andando um pouco pro outro. Na curva a 80 km/h derrapa até uns 18°; no seco, 0°. Também freia 35% menos. Bater zera a derrapagem.
- **Pedestres:** metade abre guarda-chuva, de seis cores (sorteado uma vez por pessoa), e todo mundo apressa o passo (45% mais rápido).
- **Alagamento:** uns 40 s de toró forte enchem as ruas, e depois de estiar a água leva uns 2 min pra baixar. As poças são elipses espelhadas no sentido da rua, em trecho de rua de carro a até ~70 m de rio, canal ou mar (mais da metade desses trechos alaga) e numa ou outra baixada qualquer (4%). A poça de cada trecho é sorteada uma vez e volta sempre no mesmo lugar. Até 60 poças ficam montadas em volta da câmera.
- **Carro na poça:** a água segura o carro, e entrar a mais de ~32 km/h espirra água pros lados com um "chuá". Quem estiver na calçada a até 8 m reclama ("Ei, motô! Me molhou todinho!") e se afasta.
- **Falas de chuva:** o povo reclama do toró ("Vixe, a Agamenon já deve tá alagada.", "Esqueci o guarda-chuva, de novo!").

## Bico de ônibus: BUSÃO (`offerOnibus` em `missions.js`)
A quarta oferta do celular agora sorteia entre turismo e **busão**.

1. Tu pega um ônibus que espera estacionado no meio-fio a até 250 m (aperta F perto dele).
2. Faz uma linha de 4 a 7 paradas, uma a cada ~400 m, seguindo a mesma avenida ou rua principal (primary, secondary, trunk ou tertiary com nome), por até 2,6 km.
3. Em cada parada, para no marcador: sobe gente, desce gente, e a tela conta quantos estão no busão. Quando a parada vira o destino, aparecem de 2 a 6 pessoas esperando no ponto ("Ô motorista, para aqui!"); quando o ônibus para, elas sobem e somem, e são essas que contam como passageiros.

Pagamento e cobrança:
- cada passageiro que sobe rende R$ 3;
- chegar antes do tempo dá bônus;
- pancada com gente dentro desconta, como na corrida;
- se o tempo acabar, "a empresa tira o busão de tu".

Com passageiro a bordo, o povo fala ("Motô, para no próximo, visse!", "Liga o ar, pelo amor de Deus!", "Quem tem troco pra cinquenta?").

## Passo do frevo (`src/frevo.js`)
Feito comparando com fotos e aulas de passistas (busca de imagens por passo: tesoura, ferrolho, parafuso, dobradiça). Vale para os passistas do bloco (`bloco.js`) e da Praça do Arsenal (`boemia.js`).
- Sombrinha na mão direita (sai do ombro, onde `makePerson` a pendura, e vai para o fim do antebraço), pequena como a de verdade (~50 cm de copa), erguida acima da cabeça ou ao lado com o braço esticado; o outro braço aberto na altura do ombro, como asa.
- Joelhos sempre dobrados e pulinho a cada tempo, a ~150 batidas por minuto.
- Cinco passos, trocados a cada dois compassos e misturados no último meio tempo: **tesoura** (uma perna cruza na frente da outra, alternando), **ferrolho** (chute para a frente com o calcanhar, corpo para trás), **dobradiça** (tronco para trás, joelhos para a frente, balançando), **parafuso** (pernas cruzadas, uma volta a cada quatro tempos, descendo e subindo) e **salto** (pulo alto com os joelhos para cima).
- A altura do corpo vem da perna de apoio, então o pé não afunda nem flutua.

## Som ambiente (`src/ambience.js`, `audio.ambient`)
Duas vezes por segundo o jogo vê onde a câmera está e ajusta quatro sons sintetizados (nenhum é gravação):
- **mar**: ruído grave que cresce e quebra a cada ~9 s, a até ~260 m da faixa de areia da orla de Boa Viagem e do Pina (pela linha da avenida que o tubarão usa);
- **passarinho**: bem-te-vi de três notas e assobios curtos, onde a cobertura do solo (WorldCover) mostra árvore num raio de 60 m; no fim da tarde, metade;
- **cigarra**: chiado agudo em ondas, só na mata fechada e no calor (depois das 10h);
- **sapo**: coaxar grave perto de mangue, brejo e um pouco de rio, bem mais na chuva.

A chuva cala passarinho e cigarra. O jogo não tem noite (o dia vai das 6h às 17h06), então não há grilo noturno.

Conferido pelos valores: Boa Viagem dá mar 0,91; Dois Irmãos dá passarinho 1 e cigarra 0,95; Jaqueira dá passarinho 1; Ilha de Deus na chuva dá sapo 0,33; Marco Zero fica em silêncio.

## Garagem: moto e bicicleta
A aba Garagem do celular também vende **Bicicleta** (R$ 150, pra ciclovia da orla) e **Moto 160** (R$ 600). Chegam igual aos carros, entregues na rua mais perto e sem piloto. Quem já está de moto quando aceita um MOTOXE vai com a própria, sem precisar pegar a do app.

## Bico de mototáxi: MOTOXE (`offerMoto` em `missions.js`)
A quarta oferta do celular sorteia entre busão, turismo e **mototáxi**:
1. a moto do app espera no meio-fio a até 200 m (F pra subir);
2. tu busca o passageiro a 150–500 m;
3. leva na garupa por 0,5–1,6 km.

Paga mais por km que a corrida de carro (R$ 10 + R$ 0,009/m) e o tempo é mais curto. Na garupa o passageiro fala ("Ei, motô, sem empinar, visse!", "Passa no corredor, que é mais rápido!"), pancada desconta, e descer da moto no meio do caminho perde o bico. 5 corridas dão o troféu "Mototaxista". Durante a corrida, o passageiro aparece sentado na garupa, de capacete, na pose do piloto e segurando na cintura dele. O veículo que espera é o mesmo `spawnBus(q, kind)` do busão, agora com o tipo.

## Corredor de ônibus da Conde da Boa Vista (trânsito e árvores)
A faixa exclusiva e as estações do canteiro são do `rua.js` (`buildBusCorridor`). Do lado do trânsito (`traffic.js`):
- **Ônibus na faixa de dentro:** na avenida, o ônibus vai na faixa colada no canteiro. É o espelho da faixa de fora: cada pista tem mão única, 10 m de largura e duas faixas. Os carros continuam na de fora.
- **Parada nas estações:** o ônibus freia ao chegar numa estação (`world.busStations`), para 5–8 s pro embarque e segue. Parado na estação não conta como "preso".
- **Mais ônibus:** na avenida, 40% do que nasce é ônibus (no resto da cidade, 6%).

As estações só existem depois que a rua monta. Quando elas aparecem, as árvores do canteiro que caíam em cima delas (retângulo da estação + folga) saem do bloco compacto (`trees.tira`). Conferido no teste de fumaça: o ônibus andou a 2,5 m à esquerda do eixo da pista e parou na estação.

## Ambulância (`src/ambulancia.js`)
A cada 2,5–5 minutos, uma ambulância aparece numa avenida a 120–320 m do jogador e sai de sirene ligada. É branca, com faixa vermelha, cruz, giroflex vermelho e azul piscando e "AMBULÂNCIA" escrito ao contrário no capô, pra ler no retrovisor. É genérica, sem marca de serviço real.

Ela é um carro do trânsito com `c.amb`:
- anda a 1,6 vez o limite;
- não para no sinal;
- atravessa quem está parado.

Os carros à frente, na mesma mão e a menos de 35 m, encostam no meio-fio e quase param até ela passar (`c.puxa`). A sirene é de dois tons, separada da sirene da polícia (`audio.ambulancia`), e se ouve a até 400 m. Ela some depois de 100 s ou a 700 m do jogador. Se nascer perto, a tela avisa: "🚑 Ambulância passando! Encosta e abre caminho."

## Blitz de trânsito (`src/blitz.js`)
A cada 3–6 minutos a polícia monta uma blitz numa avenida (primary, secondary ou trunk) a 160–380 m do jogador. São seis cones laranja com faixa branca fechando a faixa da direita e dois guardas de colete na calçada, acenando. A tela avisa ("🚔 Blitz na Avenida…! Passa devagar.") e a rádio também.

Passar de carro a até ~32 km/h libera: "Documento em dia, pode seguir. Bom trabalho!". 3 vezes dão o troféu "Documento em dia". Passar acima disso fura a blitz e dá uma estrela de procurado ("Ei! Para aí! Volta aqui!"). A blitz desmonta depois de 3 minutos ou quando o jogador se afasta mais de 650 m. Os cones não têm colisão nem mudam o trânsito.

## Pombos nas praças (`src/pombos.js`)
Bandos de 14 pombos ciscam no chão do Marco Zero, das praças da Independência, da República e Maciel Pinheiro, do Parque 13 de Maio e da Praça de Casa Forte. São cinzas com o pescoço esverdeado, a cabeça sobe e desce, e de vez em quando um anda um pouco. Chegou a menos de 7 m a pé (ou 15 m de carro), o bando levanta voo de uma vez: sobe batendo as asas rápido, dá voltas largas no alto e pousa de novo uns 15 s depois. Os bandos só são montados com a câmera a menos de 250 m.

## Feira livre (`src/feira.js`)
Das 6h às 13h, a frente dos mercados de bairro vira feira: Casa Amarela, Encruzilhada, Madalena, Afogados, Torre, São José e Boa Vista. São 10 barracas de lona colorida com mesa de madeira e montes de fruta ou verdura nas cores do produto. Os produtos:
- manga espada;
- caju;
- macaxeira;
- banana;
- pitomba;
- coentro e cebolinha;
- abacaxi;
- goma pra tapioca.

Atrás de cada barraca fica um feirante chamando o freguês e gritando o pregão quando o jogador passa a menos de 25 m ("Olha a manga espada, docinha, cinco real o quilo!"). A pé, perto de uma barraca, **B** compra (R$ 2 a 8); 3 compras dão o troféu "Freguês da feira". De manhã a rádio lembra das feiras. A feira só é montada com a câmera a menos de 300 m e some de tarde.

## Caranguejos e catador no mangue (`src/caranguejos.js`)
Num mangue a até ~300 m da câmera (onde a cobertura do solo diz MANGUE, em terra), 40 caranguejos andam de lado, param e mudam de direção, mexendo as perninhas. Chegou a menos de 6 m, cada um corre pra toca e some por uns segundos. Num ponto do mangue fica um catador de boné, com o balde, curvado procurando na lama, que grita "Olha o caranguejo! Corda com dez, vinte e cinco real!".

A pé e perto dele, **B** compra uma corda (R$ 25). A primeira compra dá o troféu "Cidade do mangue", e no Zap o Painho pede uma corda pra caranguejada de domingo. Desmonta quando a câmera se afasta mais de 350 m.

## Jangadas no mar de Boa Viagem (`src/jangadas.js`)
Além das jangadas paradas na areia, quatro jangadas de vela triangular colorida navegam devagar ao longo da costa, a 250–450 m da avenida da orla, já depois da arrebentação. Elas balançam nas ondas e viram quando chegam na ponta da orla ou encontram terra. Ficam num trecho de ~1,2 km em volta da câmera e só aparecem com a câmera na orla.

## Avião pousando nos Guararapes (`src/avioes.js`)
A cada 3–5 minutos um jato chega pelo norte, alinhado com a pista do Aeroporto dos Guararapes. Começa a ~9 km da cabeceira, a ~470 m de altura, e desce numa rampa de ~3°, passando baixo sobre a cidade. Toca a pista uns 300 m depois da cabeceira, freia de ~270 km/h até ~55 km/h e some no fim da pista.

O modelo é um jato branco de corredor único, com faixa azul, asas enflechadas, motores, deriva e luz de pouso acesa. O som (`audio.aviao`) é o ronco grave da turbina com um assobio agudo, ouvido a até 2,5 km. Só sai avião com a câmera a menos de ~9 km do caminho. A pista vem do OSM (aeroway runway), guardada antes de o `main.js` liberar os dados do aeroporto.

## Pipas no céu das comunidades (`src/pipas.js`)
Na comunidade mais perto da câmera (até ~700 m da borda), sete crianças empinam pipa de papel de seda colorido, com vareta em cruz e rabiola de tirinhas. As pipas ficam a 25–45 m de altura, a favor da brisa do mar, fazendo um oito no alto, com a linha esticada até a mão de quem puxa. De vez em quando (40–90 s) uma linha arrebenta: a criança grita "Apara a pipa!" e a pipa sai solta, girando e descendo devagar a favor do vento até cair no chão. A pé, chegar nela antes de ela sumir (90 s no chão ou caída n'água) apara a pipa e dá o troféu "Aparador de pipa". Com toró a molecada recolhe as pipas.

## Dominó na praça (`src/domino.js`, `audio.tac`)
Nas praças de bairro (Casa Forte, Derby, Jaqueira, Maciel Pinheiro, Sérgio Loreto, Boa Viagem, Hipódromo, Arsenal, Independência e outras que existirem no mapa), uma mesinha de madeira com quatro senhores em banquinhos. A cada 2–4 s um bate a pedra na mesa com o estalo seco do dominó, e as pedras vão aparecendo em fila. Rolam comentários ("Passo.", "Tá trancado, visse?"), e no fim da partida alguém bate ("Bati de carroça!") e outro reclama ("Caraí, de novo?"). Assistir de perto (a pé, até 6 m) uma partida inteira dá o troféu "Peru de dominó". Só monta com a câmera a menos de 200 m.

## Roda de capoeira no Marco Zero (`src/capoeira.js`, `audio.capoeiraStep`)
Das 10h ao fim da tarde, num largo livre perto do Marco Zero, uma roda de quinze de abadá branco:
- três berimbaus, pandeiro e atabaque de um lado, e o resto batendo palma;
- dois no meio jogando: giram devagar um de frente pro outro na ginga, com meia-lua de frente, cocorinha e esquiva;
- a cada ~25 s troca a dupla, e muda a cor da corda.

O som é sintetizado, no toque tradicional: o "tch-tch dom dim" do berimbau gunga, caxixi, pandeiro e agogô, pela distância até 120 m. Os gritos são "Iê!", "Joga bonito, camará!" e "Volta ao mundo!". Assistir de perto (a pé, até 9 m) uma troca de dupla dá o troféu "Camará".

## Pescadores no cais (`src/pescaria.js`)
Na beira do Capibaribe e do Beberibe no Centro (Rua da Aurora, Cais José Estelita, Marco Zero e as pontes do Centro), até três pescadores de boné por lugar, a pelo menos 12 m um do outro. Cada um fica num ponto de terra com água a 3–6 m na frente, com a vara apontando pro rio, a linha caindo n'água e o balde do lado. Eles puxam conversa quando o jogador passa ("Maré tá subindo, agora vem peixe.").

A pé e perto de um, **B** pede a vara emprestada:
1. Espera beliscar (3–8 s).
2. Quando aparece **PUXA!**, aperta **B** de novo em até 1,3 s.
3. Puxou cedo, demorou ou se afastou, o peixe foge.

O peixe pego (carapeba, tainha, bagre, siri ou, raramente, camurim) o pescador compra na hora, pelo peso. Troféus: "Pescador do Capibaribe" (primeiro peixe) e "História de pescador" (um camurim). Só monta com a câmera a menos de 200 m.

## Volta das Pontes (`src/voltapontes.js`)
Desafio contra o relógio pelas pontes do Centro: Maurício de Nassau, Buarque de Macedo, Santa Isabel, Boa Vista, Duarte Coelho, Princesa Isabel, Giratória e 12 de Setembro (as que existirem no mapa).
- **Largada:** na rua mais perto do Marco Zero, com uma marca azul que só aparece de carro ou moto e sem bico rolando. Parado nela, **B** começa.
- **Percurso:** a marca azul e a seta do minimapa mostram a próxima ponte (raio de 14 m), na ordem do vizinho mais perto, e a volta termina no Marco Zero. O objetivo na tela mostra a ponte, o tempo e a distância.
- **Prêmios:** a primeira volta paga R$ 50 e bater o recorde paga R$ 20. O recorde fica no save. Abaixo do tempo de ouro (~40 km/h de média) dá o troféu "Rei das pontes"; completar dá "Veneza brasileira".
- **Cancela:** se sair do carro, se pegar um bico ou depois de 10 min.

## Artistas de rua (`src/artistas.js`, `audio.cocoStep`)
Dois shows no Centro:
- **Mamulengo no Pátio de São Pedro:** a tolda de chita (pano vermelho de flor amarela e azul, pintado no canvas) com a janelinha no alto, onde dois bonecos de mamulengo dançam, giram e brigam. Na frente, nove crianças sentadas no chão balançam de rir ("Bate nele!", "Olha atrás de tu!").
- **Emboladores de coco no Mercado de São José:** dois cantadores de pandeiro, um de frente pro outro, trocando verso ("Embola, embola, que eu quero ver!"), com o chapéu no chão e uma rodinha em volta. O som é o coco sintetizado (pandeiro, platinela e ganzá), ouvido até 90 m.

A pé e perto, **B** joga uma moeda no chapéu (R$ 2) e o artista agradece. Assistir de perto (até 10 m) por 30 s dá o troféu de cada um ("Mamulengueiro", "Embolada"); 5 moedas dão "Mecenas da rua". Só monta com a câmera a menos de 200 m.

## Forró pé-de-serra no Mercado da Boa Vista (`src/forro.js`, `audio.forroStep`)
De tarde (a partir das 13h, quando a feira da manhã já desmontou), no pátio do Mercado da Boa Vista. O pátio agora é aberto de verdade: `lugares.js` tira a colisão de dentro com `clearBox` (`collide.js`) e abre uma passagem pelo arco do meio de cada lado comprido. As mesas dos bares continuam sólidas, menos num salão de 5 m no meio, sem mesa, onde o forró acontece. Nele ficam:
- um trio nordestino num canto: sanfoneiro de boné com a sanfona vermelha (o fole abre e fecha), zabumbeiro batendo a baqueta e o triângulo;
- quatro casais dançando xote agarradinho no salão, com o "dois pra lá, dois pra cá", girando devagar um em volta do outro e rodando pelo pátio.

O som é um xote composto pro jogo: zabumba no 1 e no "e" do 2, bacalhau no contratempo, triângulo aberto e fechado, e a sanfona com acorde no tempo e melodia em sol maior. Ouve-se até 110 m. Gritos: "Arrasta o pé, minha gente!", "Segura o fole, sanfoneiro!". Assistir de perto (a pé, até 10 m) por 30 s dá o troféu "Arrasta-pé". Só monta com a câmera a menos de 200 m; de manhã não tem.

## Mirantes (`src/mirantes.js`)
Lugares altos de onde se vê o Recife: Torre Malakoff (24 m), Morro da Conceição, Rampa Helicoidal do RioMar, terraço do Paço Alfândega e Edifício Holiday (os que existirem no mapa). A pé, a até 22 m do pé do mirante, **B** sobe:
- a câmera vai pro alto e dá uma volta inteira devagar (16 s), olhando pra fora e um pouco pra baixo;
- aparece o nome e uma frase sobre a vista ("Do alto do Holiday, a orla de Boa Viagem de ponta a ponta e o mar verde.");
- **B** de novo, andar ou entrar num carro desce antes.

Ver pelo menos 60% da volta marca o mirante no save (`save.mirantes`). O primeiro dá o troféu "Vista bonita" e três diferentes dão "Recife de cima".

## Carro de som (`src/carrodesom.js`)
Um carro do trânsito perto do jogador ganha duas cornetas no teto e sai anunciando. Quando passa a menos de 70 m, fala a cada ~9 s, com um toque de buzina baixinho. Os anúncios dizem o que está rolando agora na cidade:
- dia de jogo, com o time e o estádio;
- a troça de frevo desfilando;
- a feira livre de manhã;
- o forró do Mercado da Boa Vista de tarde;
- a capoeira no Marco Zero.

No meio, entra propaganda de bairro inventada: o ovo ("trinta ovos é quinze reais"), o gás, o Mercadinho Boa Sorte, a Loja do Seu Biu. Quando o carro some do trânsito, outro assume uns 40 s depois.

## Ônibus de passageiro no corredor (`src/passageiro.js`)
Nas estações do canteiro da Conde da Boa Vista:
1. A pé, **B** espera o ônibus.
2. O primeiro ônibus que parar naquela estação embarca o jogador. Ele passa a catraca (R$ 4,30) e some dentro do ônibus.
3. A câmera acompanha o ônibus de longe, como quando se dirige um.
4. **B** toca a campainha, e o jogador desce na próxima estação do corredor. Se o ônibus sair do corredor, desce do lado dele quando parar.

Lá dentro não dá pra pegar o volante (F não faz nada). A primeira viagem dá o troféu "Via Livre".

## Pelada e frescobol na areia (`src/praiajogos.js`)
Com a câmera na orla de Boa Viagem:
- **Pelada:** num ponto fixo a cada 400 m de praia, um campinho de ~24 × 12 m na areia molhada perto da água (os guarda-sóis ficam pro lado do calçadão), com os gols marcados por dois pares de chinelo. Jogam oito meninos, time sem camisa contra time de camisa laranja.
  - Os dois mais perto da bola de cada time correm nela, e os outros acompanham a jogada do seu lugar.
  - Quem chega na bola chuta pro gol do outro time, com erro, e de longe vai mais devagar.
  - A bola rola, quica baixo e para rápido na areia fofa. Fora do campo volta pra lateral ou pro fundo.
  - Gol: o placar é gritado ("É gol, caraí! Tá 2 a 1!") e a bola volta pro meio.
  - O jogador a pé chuta só de encostar na bola, na direção em que está andando, mais forte se vier correndo. Gol dele dá o troféu "Craque da areia".
- **Frescobol:** até três duplas na beira d'água (a ~4 m da água, longe do campinho), a 3,2 m uma da outra, com a bolinha amarela fazendo um arco entre as raquetes de madeira e o "toc" a cada batida (até 25 m). De vez em quando a bolinha cai e alguém vai buscar.

## Bicicleta compartilhada (`src/bicicletas.js`)
Estações de bicicleta laranja de aluguel no Marco Zero, na Jaqueira, no 13 de Maio, em Casa Forte, no Dona Lindu, no Segundo Jardim e na Praça de Boa Viagem (as que existirem no mapa). Cada estação tem o totem laranja com a telinha, a barra de trava e cinco bicicletas de passeio, sem a bag de entregador. Fica numa calçada livre a partir de 14 m do ponto e só monta com a câmera a menos de 220 m. A mesa de dominó, a roda de capoeira e a estação marcam o espaço que ocupam em `world.ocupados` (`[x, z, raio, chave]`), e cada uma desvia do espaço das outras na hora de montar.

A pé e perto da estação, **B** aluga uma (R$ 5) e o jogador já sai pedalando. Descer da bicicleta alugada a até ~15 m de uma estação devolve; longe, ela fica estacionada onde parou. O primeiro aluguel dá o troféu "Pedalando no Recife".

## Malabarista no sinal (`src/malabarista.js`)
Parado no vermelho de carro ou moto (não de bicicleta nem de ônibus), às vezes (metade das vezes, no máximo uma a cada 25 s) um malabarista entra na faixa 5 m na frente do carro e joga três clavas coloridas em cascata. Depois de uns 7 s passa na janela pedindo uma moedinha:
- **B** dá R$ 2 (troféu "Respeita o artista");
- abriu o sinal ou o carro andou, ele volta pra calçada e some.

Pode vir junto com o ambulante do sinal: o **B** atende primeiro o ambulante.

## Hora do rush
De 6h30 às 9h e depois das 16h, o trânsito em volta do jogador sobe de 55 pra 70 carros (`traffic.maxCars`, com `traffic.rush` ligado).

## Passeio de catamarã pelo Capibaribe (`src/catamara.js`)
O catamarã de passeio (dois cascos azuis, convés branco, toldo amarelo e bancos, baixo o bastante pra passar debaixo das pontes) fica no cais do Marco Zero, balançando na água. A pé e perto do cais, **B** embarca (R$ 30).

O catamarã contorna o Recife Antigo e sobe o Capibaribe por baixo das pontes do Centro: Maurício de Nassau, Buarque de Macedo, Boa Vista, Santa Isabel e Princesa Isabel (as que existirem no mapa), na ordem de quem está mais perto. A ~9 m/s, o passeio dura uns 5 minutos. A câmera acompanha o barco de longe.

O caminho é achado pela água uma vez, na primeira viagem:
- A* numa grade de 6 m, com folga de 900 m em volta pra poder contornar a ilha;
- a água rasa de margem custa 3× mais, pra o barco ir pelo meio do rio;
- a célula da ponte, que tapa a água, cai na água mais perto;
- depois a rota é suavizada.

O guia narra cada lugar uma vez, numa legenda na caixa de objetivo, quando passa a menos de 160 m:
- o Parque das Esculturas de Brennand, o Cais do Sertão e a ponte de Nassau (a primeira grande ponte do Brasil, no século XVII);
- o Palácio do Campo das Princesas e o Teatro de Santa Isabel (1850);
- a Ponte da Boa Vista, a Rua da Aurora e o caranguejo gigante;
- a Casa da Cultura (antiga Casa de Detenção) e os armazéns do Cais José Estelita.

No fim, o jogador volta pro cais e ganha o troféu "Veneza de catamarã". **B** durante o passeio volta pro cais antes, sem troféu.

## Agenda do Recife (`src/agenda.js`)
Uma aba nova no celular, **Agenda**, logo depois de Bicos, junta num lugar só tudo o que tem pra fazer:
- jogo do dia e troça de frevo (quando estão rolando);
- feira livre, forró, capoeira, mamulengo e emboladores;
- pescaria, dominó, catamarã, Volta das Pontes (com o recorde), o mirante mais perto que falta ver, bicicleta, praia e ônibus do corredor.

Cada item mostra o bairro, uma frase, a distância e uma etiqueta: **AGORA** (amarela) se está rolando ou o horário em que abre. Os que estão rolando vêm primeiro, depois do mais perto pro mais longe. Escolher um (tecla 1–9, clique ou toque) traça a rota no GPS e fecha o celular.

A mesma lista aparece no mapa grande (M) como ícones (🎣 🪗 🤸 🎭 🥁 🎲 ⛴️ 🏁 🔭 🚲 🏖️ 🚌 🍍), amarelos quando estão rolando e lilás quando não. Os ícones não entram no minimapa, pra não poluir.

## Desafios do dia (`src/desafios.js`)
A cada dia novo do jogo (quando o relógio volta das 17h pras 6h), três desafios sorteados de uma lista de vinte, sem repetir os de ontem. Exemplos: pescar 2 peixes, fazer um gol na pelada da praia, o catamarã até o fim, a Volta das Pontes, 2 corridas ou 2 entregas de bico, uma linha de ônibus, comprar na feira, moeda pros artistas, aparar uma pipa, caranguejo no mangue.

- **Progresso:** vem dos mesmos contadores dos troféus (`conta`/`onConta`), então tudo o que já conta pra troféu conta pro desafio.
- **Prêmios:** cada desafio paga na hora (R$ 10 a R$ 40, com aviso "✅ Desafio do dia") e os três juntos dão um bônus de R$ 50.
- **Onde ver:** no topo da aba Agenda do celular, com ✅/⬜, o progresso e o prêmio de cada um. O dia novo avisa com "☀️ Dia novo!".
- **Save:** fica em `save.desafios` (`dia`, `lista`, `bonus`).

## Casamento na saída da igreja (`src/casamento.js`)
De vez em quando (uns 5 a 7 min), na igreja mais perto do jogador (de 30 a 250 m, da lista de igrejas dos sinos), os noivos saem pela porta:
- noivo de terno escuro e noiva de vestido branco com véu, andando de braço dado pelo corredor;
- doze convidados em duas fileiras, batendo palma e jogando arroz pra cima (pontinhos brancos que sobem e caem), gritando "Vivam os noivos!" e "Joga o buquê!";
- na rua, o carro branco dos noivos com latinhas amarradas atrás e a plaquinha "RECÉM-CASADOS ♥".

Os noivos entram no carro, ele sai devagar pela rua e a cena some. A porta é o primeiro ponto livre saindo da igreja em direção à rua mais perto. Estar a até 25 m na hora da saída dá o troféu "Padrinho de ocasião".

## Caminhão de lixo (`src/lixo.js`)
A cada ~4 a 5 min sai um caminhão compactador (cabine branca, caçamba verde com faixa branca e estribo atrás) numa rua a 60–180 m do jogador. Ele entra no trânsito normal, mas a no máximo 3,2 m/s (`car.lento`). Dois garis de laranja correm atrás:
- o caminhão vai achando sacos pretos na calçada à frente, do lado direito, um a cada ~20–35 m;
- quando passa por um, um gari corre, pega e volta pro estribo, revezando com o outro ("Segura aí, motorista!").

O caminhão some quando fica a mais de 400 m ou depois de 3 min. Se o jogador roubar o caminhão, ele fica com o jogador.

## Barbearia de bairro (`src/barbearia.js`)
Seis barbearias de nome inventado (Barbearia do Biu, Salão do Galego, Barbearia Nevou, Corte do Júnior, Barbearia Pernambucana, Barbearia do Tonho), uma na calçada perto de cada mercado: Casa Amarela, Encruzilhada, Afogados, Madalena, São José e Boa Vista. Ficam a partir de 45 m do mercado, pra não cair na feira, e marcam o espaço em `world.ocupados`. Cada uma é um quiosque branco de costas pra parede, com:
- o letreiro azul e amarelo com o nome;
- o poste listrado vermelho, branco e azul girando;
- o espelho e a cadeira de couro vermelho;
- o barbeiro de branco, de pé.

A pé e perto, **B** corta o cabelo (R$ 15). Cada corte é o próximo da lista: social, máquina 1, nevou (platinado), cacheado, black power, luzes, tranças nagô e careca. O barbeiro comenta ("Nevou! Platinado pra brilhar no paredão."). O corte fica salvo no visual do jogador (`save.outfit.hair` e `hairColor`). Troféus: "Na régua" (primeiro corte) e "Cliente fiel" (4 cortes).

## Objetivo: Caçada às Lendas do Recife (`src/lendas.js`)

O objetivo do jogo. Dez lendas soltas na cidade, contadas com humor do dia a dia do Recife:

| Lenda | Tipo | Onde |
|---|---|---|
| Perna Cabeluda | assombração (folclore dos anos 70) | Rua da Aurora |
| Papa-Figo aposentado | assombração | Mercado de São José |
| Emparedada da Rua Nova | assombração | Rua Nova, Santo Antônio |
| Comadre Fulozinha | assombração | Jardim Secreto do Poço da Panela |
| Guia Autodeclarado do Marco Zero | figura inventada | Marco Zero |
| Profeta do Corredor | figura inventada | Av. Conde da Boa Vista |
| Coach Quântico da Orla | figura inventada | calçadão de Boa Viagem, perto do 3º Jardim |
| Galego Amigo do Tubarão | figura inventada | areia do Pina |
| Tia do Bom Dia | figura inventada | Mercado da Encruzilhada |
| Influencer do Cais | figura inventada | Rua do Bom Jesus |

As figuras são inventadas; nenhuma é pessoa real. Como o Recife tem várias ruas com o mesmo nome, cada lenda de rua vai pro trecho mais perto de um ponto dado (a Rua da Aurora da beira do Capibaribe, não a da Estância).

- **Começar:** aba **Lendas** do celular (a segunda). **1** ou um clique no cartão de objetivo começa a caçada. Uns 25 s depois de abrir o jogo aparece o convite, se a caçada nunca começou.
- **Tempo:** o cronômetro corre enquanto se joga e aparece no canto da tela (🕵️ Lendas 3/10 · 12:34).
- **Dicas:** cada lenda não achada mostra uma charada. Por R$ 20 (tecla do número, 0 pra décima, ou clique), a aba mostra o bairro.
- **Achar:** a pé, chegar a 5 m. A lenda solta a fala, aparece o cartão e a figurinha entra na aba com uma legenda irônica. De perto (25 m) elas soltam frases que ajudam a achar. Fora da caçada, mandam o jogador abrir o celular.
- **Visual:** a Perna Cabeluda é uma perna gigante e cabeluda, com a barra da bermuda, pulando. A Emparedada é um fantasma translúcido colado na parede de um sobrado. A Fulozinha é baixinha, de cabelo comprido com flores, e aparece e some. Os outros têm placa ou objeto próprio: "SÓ FIGO", bandeirinha de guia, "O ÔNIBUS VEM!", "MINDSET 40 GRAUS", boia, celular no pau de selfie com ring light.
- **Fim:** as dez fecham o tempo, que entra no ranking local (os 5 melhores, salvos no aparelho em `save.rankingLendas`). A primeira vez paga R$ 300. Dá pra caçar de novo.
- **Troféus:** Vi uma lenda, Meio caminho assombrado, Caçador de Lendas e Mais rápido que a Perna Cabeluda (menos de 20 min).

## Ensaio de quadrilha junina (`src/quadrilha.js`)

No Sítio da Trindade, em Casa Amarela (onde acontece o São João do Recife), das 14h até o relógio virar, já que o jogo não tem noite. O ensaio procura um terreiro livre de uns 14 × 10 m dentro do sítio e tira as árvores de cima dele com `trees.tira`. Lá monta:
- bandeirinhas de chita em zigue-zague entre quatro postes e uma fogueira que tremula na ponta;
- na cabeceira, o marcador de chapéu de palha com o microfone e o sanfoneiro;
- seis casais, cavalheiros de chapéu de palha e damas de vestido de chita.

O marcador puxa uma figura a cada 7 s: cumprimento, balancê, caminho da roça, olha a chuva, é mentira, túnel, grande roda e anarriê. Os casais andam até as posições de cada figura e fazem os gestos: braços pra cima na chuva, arco no túnel, mesura no cumprimento.

- A pé, perto, **B** entra no ensaio no lugar do sexto cavalheiro e o jogador dança com o grupo, sem o controle dos pés. A cada figura gritada, **B** dentro de 1,8 s acompanha o passo. Acertar 6 das 8 conta pro troféu Matuto arretado.
- Assistir 40 s de perto dá o troféu Olha a fogueira. Entra na Agenda e no sorteio dos desafios do dia.
- O som é o do forró do jogo (composição própria), pela distância.

## Corrida da Orla (`src/corrida.js`)

Das 6h às 10h, no calçadão de Boa Viagem, a largada fica no Parque Dona Lindu: pórtico inflável vermelho, locutor chamando ("Inscrição aberta!") e 14 corredores numerados esperando. A pé, **B** na largada faz a inscrição (R$ 10). Depois da contagem a corrida sai rumo ao norte: 2 km pelo meio do calçadão (a faixa é calculada pela Av. Boa Viagem, depois da pista e da ciclofaixa), com mesa de água e voluntária na metade e o pórtico azul de CHEGADA lá na frente. O topo da tela mostra posição, tempo e quanto falta.

- Correr (Shift) é 8 m/s; o pelotão vai de 5,4 a ~8 m/s, então ganhar exige correr a prova toda.
- Pódio paga R$ 150, 80 e 50; os outros ganham a medalha de participação. O melhor tempo fica salvo e aparece na Agenda.
- Uma corrida por dia. Pegar carro, sair da orla (70 m do calçadão) ou passar de 15 min desclassifica.
- Troféus: Peito nº 1, Pódio na orla, Campeão da orla. Entra no sorteio dos desafios do dia e na Agenda do celular.
- A corrida e o nome são inventados.

## Escolha de personagem (`src/avatar.js`)
Seis personagens do Recife, com nomes e histórias inventados:

| Personagem | Quem é |
|---|---|
| Biu do Frevo | Passista desde menino, sobe ladeira de Olinda sem perder o passo. Pele negra, cabelo raspado e barba. |
| Dandara do Maracatu | Batuqueira do baque virado. Pele negra, tranças presas no coque. |
| Galego da Orla | Mora em Boa Viagem, vive vermelho do sol e jura que viu o tubarão. Pele clara, cabelo loiro. |
| Júlia de Casa Amarela | Faz corrida de app e conhece todo atalho (e todo buraco). Pele morena, cabelo longo. |
| Kaê do Passinho | Dança brega-funk em qualquer calçada, cabelo platinado ("nevou"). Pele parda. |
| Seu Severino | Aposentado, rei do dominó da praça. Cabelo e barba grisalhos. |

**Onde escolher:**
- **Tela de início:** os seis aparecem acima do JOGAR, com retrato desenhado (SVG feito com as cores de cada um); a história do escolhido aparece embaixo.
- **Celular:** na aba **Serviços**, "Personagem: …", cada toque passa pro próximo.

A escolha fica salva (`save.avatar`, padrão Biu). Cada personagem tem seu corpo (masculino ou feminino), tom de pele, cabelo e cor de cabelo, barba ou não, e roupa (regata, bermuda e tênis nas cores dele). O corte da barbearia vale por cima do cabelo do personagem, e trocar de personagem zera o corte. Boné, óculos e camisa da loja continuam valendo.

`outfitOpts()` (main.js) passa `sexo`, `skin` e `barba` pro corpo de verdade (`protagonista.js`). Para testar: `game.avatar.escolhe('dandara')`.

## Natal no Marco Zero (`src/natal.js`)
Do dia 15 de novembro ao Dia de Reis (6 de janeiro), pela data do computador, a praça do Marco Zero ganha uma árvore de Natal gigante: 16 m de argolas verdes empilhadas em cima de uma base vermelha, com presentes no pé, uma estrela dourada girando no topo e centenas de luzinhas de seis cores piscando em três grupos alternados. A árvore fica num largo livre a pelo menos 18 m do Marco Zero, longe da pista e da roda de capoeira.

Na frente dela fica o Papai Noel de roupa vermelha completa, gorro e barba, se abanando no calor e reclamando ("Ho ho ho! Que calor da gota!", "Ano que vem eu venho de bermuda.", "As renas foram tomar banho em Boa Viagem.").
- **Foto com o Papai Noel:** a pé, perto dele, **B** tira foto por R$ 10 e faz um pedido sorteado ("um ar-condicionado que não pinga", "que a Agamenon não alague nunca mais", "uma vaga pra estacionar no Recife Antigo"…). Ele levanta os braços pra pose. No toque, o botão de ação vira "foto".
- **Extras:** troféu "Bom Velhinho" e entrada na agenda do celular ("até o Dia de Reis").
- **Teste:** `game.natal.forca = true` (ou `false`) força a época; `null` volta à data do computador.

## Bico de picolé na areia (`src/picole.js`)
A areia de Boa Viagem agora tem guarda-sol colorido com banhista sentado na canga, olhando pro mar: até dois por trecho de 14 m, num raio de ~260 m em volta da câmera. Cada guarda-sol é sorteado uma vez pelo trecho e volta sempre no mesmo lugar.

No calçadão, uns 250 m ao sul do Parque Dona Lindu, fica o quiosque **Picolé Arretado** (balcão-freezer azul e branco, toldo amarelo e o dono de boné).
- **Pegar o isopor:** a pé, perto do quiosque, **B** pega um isopor com 12 picolés, que vai na mão do jogador.
- **Freguês:** de tempos em tempos, um banhista a até 40 m levanta a mão e grita ("Ô do picolé!"). Perto dele, **B** vende por R$ 4, de um sabor sorteado (coco, graviola, cajá, tapioca, milho verde, maracujá, umbu, açaí). Três em cada dez dão R$ 2 de gorjeta.
- **Pregão:** sem freguês perto, **B** grita ("Olha o picolé! Coco, graviola, cajá!") e até dois banhistas em volta chamam.
- **Fim:** vendendo tudo aparece "Vendeu o isopor todinho!". Depois de 4 minutos, "O resto derreteu!". Entrar num carro ou ficar 12 s fora da praia larga o isopor.

O placar fica no objetivo da tela (picolés no isopor, quanto ganhou e o tempo até derreter). No toque, o botão de ação vira "pegar", "vender" ou "gritar". Quem já comprou não compra de novo na mesma sessão.

Também conta:
- troféu "Olha o picolé!", por vender o isopor inteiro;
- desafio do dia "Vende 6 picolés";
- entrada na agenda do celular ("o dia todo").

## Bico de galão de água em Casa Amarela (`src/galao.js`)
Na calçada perto do centro de Casa Amarela (sempre no mesmo ponto) fica o **Depósito Água Boa**: balcão, toldo azul, placa "ÁGUA BOA · galão 20 L · entrega", pilha de galões azuis e Seu Didi de boné.
- **Pegar o galão:** a pé, perto do depósito, **B** pega um galão de 20 L, que vai no ombro. O GPS marca a casa da freguesa, numa calçada a 120–380 m dali.
- **Peso:** com o galão no ombro você anda a 62% da velocidade e não corre (nem Shift, nem o botão de correr do toque).
- **Entregar:** a uns 70 m, a freguesa aparece na porta acenando ("Aqui, moço da água!"). Perto dela, **B** entrega por R$ 10, mais até R$ 6 de gorjeta, que diminui com o tempo gasto.
- **Perder a entrega:** entrar num carro deixa o galão no chão; estourar o tempo (distância ÷ 2,2 m/s + 45 s) faz a freguesa pedir noutro depósito.

O objetivo da tela mostra o nome da freguesa, a distância e o tempo. No toque, o botão de ação vira "pegar" ou "entregar".

Também conta:
- troféu "Ombro de ferro", por 5 entregas;
- desafio do dia "Entrega 2 galões";
- entrada na agenda do celular.

## Partida de dominó na praça (`src/dominojogo.js`)
Nas mesas de dominó das praças (`src/domino.js`), a pé do lado da mesa, **B** senta pra jogar de dupla: você e Seu Severino (seu parceiro, na sua frente) contra Seu Biu e Seu Tonho.

Regras:
- 28 pedras, 7 pra cada. Quem tem a carroça de sena (6|6) abre o jogo.
- Na sua vez, as pedras que servem acendem: toca numa. Se ela servir nas duas pontas, escolhe o lado. Sem pedra que sirva, você passa sozinho.
- **Bateu** (acabou a mão): a dupla dele ganha. **Trancou** (quatro passes seguidos): ganha a dupla com menos pontos somados na mão; ponto igual é empate.
- Os senhores jogam a pedra mais pesada que serve e escolhem a ponta que deixa mais pedras deles servindo.

Ganhando, a dupla leva R$ 15; perdendo, você paga o café (R$ 5, perdoado se estiver liso). **Esc** ou "Levantar ✕" sai no meio. A tela é HTML por cima do jogo e funciona no toque (o botão de ação vira "jogar"). Enquanto ela está aberta, as teclas não mexem o personagem.

As regras ficam na classe `Partida`, sem tela, pra dar pra testar sozinha. Em 500 partidas só entre computadores: 248 a 248, 4 empates e 67 trancadas.

Também conta:
- troféu "Lá-e-lô!", por ganhar uma partida;
- desafio do dia "Ganha uma partida de dominó";
- a dica na agenda do dominó agora avisa que dá pra sentar.

## Sinos das igrejas (`src/sinos.js`, `audio.sino`)
A cada hora cheia do jogo, a igreja mais perto do jogador (a menos de 450 m) bate o sino uma vez por hora, como relógio de 12 horas (15h dá 3 batidas), uma a cada 1,6 s. As igrejas vêm dos lugares de culto do mapa e dos nomes com igreja, basílica, capela, matriz, convento, concatedral ou paróquia. O sino é sintetizado com parciais de sino (fundamental, terça menor, quinta, oitava e um "hum" grave) que demoram a sumir, com o volume pela distância. Quando o relógio volta das 17h pras 6h, não toca.

## Troça de frevo no Recife Antigo (`src/bloco.js`)
Das 15h às 20h (hora do jogo), a **Troça Caraí Que Calor** desfila pelas ruas a pé em volta do Marco Zero. É uma troça inventada, com nome próprio do jogo. O desfile vai e volta por um caminho de ~1,3 km, sorteado com semente: sempre o mesmo, o mais longo de 24 tentativas. Anda a ~1 m/s.

Formação:
- na frente, a porta-estandarte, com estandarte vermelho bordado de dourado;
- quatro fileiras de três passistas de sombrinha, no passo do frevo (ver abaixo);
- dez foliões pulando em volta;
- atrás, a orquestra de metais de camisa branca.

O bloco só aparece a menos de 450 m da câmera. A orquestra se ouve a menos de 160 m: é a melodia da Rádio Frevo tocada por metais (dente de serra abafado, trombone uma oitava abaixo), com surdo e caixa (`audio.frevoStep`).

Chegando perto, aparece "A Troça Caraí Que Calor tá passando! Aperta G pra brincar no bloco." Dançar a menos de 25 m dela por 8 s conta como brincar e rende R$ 20, uma vez por desfile.

## Personagens (`makePerson` em `models.js`)
Sem opções, `makePerson()` sorteia um recifense comum:
- **Tipo**: homem, mulher (ombro mais estreito, cintura e quadril) ou idoso (grisalho, às vezes careca ou de barba, um pouco curvado).
- **Em cima**: camisa, regata, camisa de time (Sport rubro-negra listrada, Náutico de listras verticais vermelhas e brancas, Santa Cruz tricolor), moletom ou vestido.
- **Embaixo**: calça, bermuda ou saia.
- **Nos pés**: tênis ou chinelo de dedo colorido.
- **Cabelo**: curto, raspado, cacheado, longo, coque, rabo de cavalo, tranças ou black power. Alguns homens têm barba.

Quem passa roupa (seguranças, frevo, flanelinhas, banhistas) continua como estava: o sorteio só preenche o que não veio. Não há crianças andando na rua, porque o jogo tem atropelamento.

Para ver os personagens sem o painel do navegador: `node scripts/foto.mjs saida.png "<JS que monta a cena>"` tira uma foto do jogo num Chrome sem janela.

## Memória (`scripts/medir-memoria.mjs`)
O painel do navegador não mede direito: o jogo segue alocando e a coleta de lixo não roda na hora. O script abre um Chrome sem janela, espera o jogo abrir, força `gc()` e mostra o heap de JS separado dos buffers (`ArrayBuffer`).
```bash
node scripts/medir-memoria.mjs "" "?mapa=antigo" "?semcobertura"
```
- `AMOSTRA=1` lista as funções que mais retêm memória; `EXTRA="<expressão>"` avalia um JS na página e mostra o resultado.
- `window.loadTimes[i][2]` guarda o heap (MB) no fim de cada etapa do carregamento.
- **Árvores** (mata, quintal, mangue): cada bloco de 800 m fica guardado compacto (5 números por árvore). A malha só é montada a menos de 1,5 km da câmera e é desmontada a mais de 1,9 km, no máximo 2 blocos por quadro. Antes, ~500 mil árvores ficavam montadas o tempo todo.
- **Medição** (mapa padrão, depois do gc): ~1,5 GB, sendo ~490 MB de objetos de JS e ~1 GB de buffers. Antes eram ~1,8–1,9 GB, com 840–980 MB de objetos. Dos buffers, ~600 MB são blocos de prédio que nunca apareceram na tela e por isso nunca foram liberados. Isso fica no `world.js`, com a sessão de gráficos.

**Rodada de 21/11 (perfil de alocação, gc forçado, rua montada):** heap total de ~717 para ~570–630 MB (o total varia entre cargas), com a cidade idêntica (`?hashgrade` igual).

| O quê | Antes | Depois |
|---|---|---|
| Grafo do trânsito (`buildGraph` + `add`) | ~135 MB | ~79 MB |
| Mangue e mata (`buildMangue`) | 43 MB | 12 MB |
| Árvores de rua (`trees.js`) | ~40 MB | ~0 |
| Pontos de rua do `buildClassics` | 29 MB | ~1 MB |

O que mudou em cada um:
- **Grafo do trânsito:** a aresta virou a classe `Edge`. Comprimento, direção e afastamento da faixa ficam numa tabela Float64 compartilhada (4 números por aresta) e o meio é calculado das pontas. Número quebrado num objeto vira uma caixinha à parte no Chrome, e com 470 mil arestas isso pesava. O `Map` de nós com chave em texto (`"x,z"`) virou uma lista.
- **Árvores de rua:** cada bloco fica guardado compacto (6 números por árvore) e as malhas instanciadas só existem perto da câmera. É a mesma ideia do mangue. Antes a cidade inteira ficava montada, e as matrizes dos blocos longe nunca iam pra placa de vídeo.
- **Mangue, árvores e marcos:** as listas de trabalho (`mata`, `trees`, `roadPts`) ficavam presas porque uma função interna as usava e a animação, que vive o jogo todo, mantinha o escopo vivo. Agora elas são esvaziadas depois da montagem.

## Cidade preenchida (`src/infill.js`), comparada com o satélite
Comparei o trajeto Recife Antigo → Av. Militar → Ponte do Limoeiro → Av. Norte → João de Barros → Graças, de cima, com o satélite do Google Maps na mesma escala. O traçado das ruas bate, porque vem do OSM. A diferença estava entre as ruas: o OSM do Recife só tem parte das construções, e muitos quarteirões ficavam vazios (terra bege), enquanto no satélite é tudo telhado e copa.
- **Lotes gerados** (`infillCity`, antes da colisão): ao longo das ruas de carro, dos dois lados, entram casas e prédios onde não há prédio, rua, água, parque, areia ou aeroporto. Atrás de cada lote vai uma segunda casa e, no miolo dos quarteirões que já são bairro, casas alinhadas com a rua mais perto.
  - São cerca de 98 mil, marcados como gerados, em uns 1,2 s.
  - Não entram numa faixa de 30 m da beira d'água (lá é mangue), nem nas áreas abertas de propósito: Praça do Arsenal e a frente dos estádios (`data.noInfill`).
- **Mangue e quintais** (`buildMangue`): árvores baixas e cerradas na terra livre da beira de rio e de maré, e árvores de quintal no que sobra livre dentro dos bairros. São instâncias em blocos de 800 m que só aparecem perto da câmera.
- **Custo**: o carregamento ficou entre 8,9 e 10,3 s, contra 8,1 s antes. Medi uma vez de cada jeito, com o painel do navegador escondido, então o número é aproximado.

## Prefeitura e Fórum (em `src/marcos.js`)
- **Prefeitura do Recife** (Cais do Apolo): lâmina de ~72 m coberta de brises verticais claros, empenas brancas, mural colorido numa empena, e embasamento baixo com faixa de janelas, o letreiro "PREFEITURA DO RECIFE" e palmeiras.
- **Fórum Joana Bezerra** (Fórum Des. Rodolfo Aureliano): bloco de granito marrom-rosado com pilarões de altura total na frente do vidro escuro, o nome na viga do alto, escadaria e palmeiras. O contorno é o bloco grande do OSM ao lado do endereço (o OSM não traz o nome).

## Estádios do Trio de Ferro (`src/estadios.js`, a partir de fotos aéreas)
A arquibancada é gerada em degraus ao longo de uma superelipse ajustada ao contorno do OSM: oval no Arruda, retângulo de cantos redondos nos Aflitos e na Ilha. As cores das cadeiras vão por vértice, e o gramado é listrado, com linhas e traves.
- **Arruda (Santa Cruz)**:
  - Oval grande de concreto com nervuras na fachada, anel inferior escuro e anel superior em blocos de cadeira vermelhos, brancos e pretos.
  - Fosso cinza em volta do campo e refletores nas quinas.
  - Ao lado, o parque aquático do clube, com guarda-sóis vermelhos e brancos.
- **Aflitos (Náutico)**: arquibancada colada no campo, com cadeiras vermelhas e fileiras brancas, "NÁUTICO" escrito atrás do gol, cobertura escura numa lateral e muro branco com faixa vermelha.
- **Ilha do Retiro (Sport)**: faixas diagonais vermelhas e pretas, a social mais alta e coberta numa lateral, refletores nas quinas e parque aquático ao lado.
- **Fachadas vistas da rua**, a partir de fotos:
  - **Arruda**: concreto aparente com pilar em todo vão, circulação escura recuada e faixas brancas. Na entrada, a fachada nova da sede: painel branco com hexágonos vermelhos, brancos e pretos, escudo, faixa vermelha "SANTA CRUZ FUTEBOL CLUBE", térreo preto com pilares e grade.
  - **Aflitos**: muro branco com painéis vermelhos embaixo e faixa vermelha no alto. Ao lado, a sede art déco do Clube Náutico Capibaribe, com torre redonda de faixas de janela, o nome no alto, aleta e ala vermelhas e gradil vermelho.
  - **Ilha do Retiro**: concreto pintado de preto, faixas vermelhas e os pilares inclinados de concreto. Na entrada, o bloco preto com a faixa "ESTÁDIO ADELMAR COSTA CARVALHO", o escudo grande e os portões; numa curva, o painel de murais vermelho e preto.
  - Os escudos são estilizados (forma e cores do clube), sem reproduzir os brasões.
- **Entrada**: a frente de cada estádio dá para a rua de carro mais próxima, e as caixas de prédio sem nome entre a fachada e a rua saem do mapa (`pruneEstadios`, antes da colisão). A sede fica do lado do portão com menos prédio no caminho.
- **Colisão**: só arquibancada, muro e sede. O portão de pedestre fica do outro lado da sede e dá acesso ao gramado.

## Marco Zero e entorno (`src/marcozero.js`, a partir de fotos)
- **Praça**: piso cor-de-rosa/terracota, a Rosa dos Ventos de Cícero Dias colorida (anel rosa, linha azul, estrela de 16 pontas em triângulos coloridos) e o medalhão de bronze "Marco Zero · Recife · Pernambuco". Também há coqueiros nas laterais, barquinhos coloridos no cais e carrinhos coloridos.
- **Prédios em volta**:
  - Torre redonda de vidro escuro com lajes brancas.
  - Associação Comercial: eclético creme, com duas torrinhas de cúpula cinza, frontão e porta vermelha em arco.
  - Caixa Cultural: amarela, com torres de quina e cúpulas douradas. Saiu do gerador neoclássico.
  - O prédio verde com uma cupulazinha.
  - Centro de Artesanato: galpão bege com pórtico e o letreiro colorido "Artesanato de Pernambuco".
  - O galpão amarelo de telhado laranja no cais.
- **Parque das Esculturas**: a Torre de Cristal ficou com base de tijolo, treliça vazada, braços em cruz e a pinha espinhenta no topo. Ao longo do molhe há arcos de tijolo com pinha e totens de terracota.

## Comunidades (`src/culture.js`)
- **Com vida própria completa** (paredão de brega, roda de passinho, terreiro, pelada e o que é só delas): Brasília Teimosa, Coque, Ilha de Deus, Morro da Conceição e Alto José do Pinho.
- **Antes só tinham o casario**: agora cada uma ganha uma parte da vida cultural (lista `feat`), variando entre elas. São Alto do Mandu, Alto Santa Teresinha, Alto José Bonifácio, Vasco da Gama, Alto Nossa Senhora de Fátima, Córrego do Botijão, Bolo de Noiva, Linha do Tiro e Bomba do Hemetério.
- **Novas**:
  - Pelo bairro do OSM: Santo Amaro, Coelhos, Mustardinha, Vila Tamandaré e Peixinhos.
  - Pelo endereço pesquisado (`at`): Pilar, Caranguejo Tabaiares, Vila Santa Luzia e Ilha do Joaneiro.
  - Entra Apulso e a Comunidade do Bode ficaram de fora: o OSM e a busca de endereços não dão a posição.
- **Ensaio de maracatu de baque virado** (novo): batuqueiros com alfaias em três fileiras, a corte (rei e rainha de coroa sob o pálio) e baianas de saia rodada girando, com o som de batuque.
  - Está no Alto José Bonifácio, na Linha do Tiro, na Bomba do Hemetério, em Santo Amaro e em Peixinhos.
- **Medição**: `?semgerados` na URL desliga os prédios gerados de `infill.js`, para comparar o tempo de carregamento.

## Caramelos e pedestres na calçada
- **Cachorros caramelo** (`src/caramelos.js`):
  - Até 9 vira-latas em volta do jogador. Ficam deitados ou farejando na calçada e, de tempos em tempos, atravessam a rua no trotezinho até a calçada do outro lado.
  - Esperam o carro passar, e o trânsito freia pra eles (entram em `traffic.extraObstacles`).
  - Se o carro do jogador vem rápido, o caramelo dá um pinote pro lado ("Au! Au!") e escapa.
- **Pedestres fora da pista** (`traffic.js`):
  - O pedestre só nasce na calçada e anda sempre no lado da aresta que não é pista de carro (bit `DRIVE` da grade).
  - Se o próximo passo cairia na pista ou atravessaria a pista na diagonal (esquina), ele dá meia-volta pela calçada.

## Gente da rua (`src/gente.js`)
- **Flanelinhas** nas ruas com carro do Recife Antigo, balançando a flanela. Quando o jogador passa de carro (ou a pé, bem perto), chamam: "Bora, dotô! Uma vaguinha?".
- **Calçadão de Boa Viagem**: gente correndo e caminhando, indo e voltando. Barracas de água de coco e de açaí alternam na beira da areia a cada ~260 m.
- O calçadão ficou livre: sem árvore de rua e sem coqueiro no meio.

## Nada no meio da pista
- A grade de colisão ganhou o bit `DRIVE` (pista de carro, sem calçadão e ciclovia).
- Ao montar qualquer modelo, `Kit.build` descarta peças pequenas e baixas (banco, árvore, barraca, mesa, poste, chafariz) com o centro numa pista.
- Pontes, rampas, passarelas e estais da ponte estaiada ficam fora dessa regra (`keepOnRoad`).

## Praça do Arsenal (fotos da reforma)
- Ocupa o quarteirão entre o Paço do Frevo, a R. do Bom Jesus, a R. do Observatório e a R. da Guia. Saíram dali as caixas de prédio, o chafariz antigo e a estátua genérica.
- Piso de placas brancas com juntas de grama, gramado central, canteiro redondo de mureta branca com agaves, palmeiras imperiais, árvores folhudas na borda, pufes brancos e postes pretos.

## Ítalo Sena
O humorista fica no calçadão em frente ao Segundo Jardim, com uma rodinha de gente rindo. Quando o jogador chega perto, solta o bordão: "Aguarde o processo, vú!".

## Intro de carregamento (`src/intro.js`, `public/intro/`)
- Mostra fotos tiradas do próprio jogo, com zoom lento, a curiosidade de cada lugar, uma dica de tecla e a barra de progresso: Marco Zero, Praça do Arsenal, Galo, Rua da Aurora, Dokas, Ponte Estaiada, orla e Arruda.
- Para refazer as fotos, o servidor de desenvolvimento aceita `POST /__shot?name=x`, que grava `public/intro/x.jpg` (plugin em `vite.config.js`).

## Gráficos
- As árvores de rua têm copa de cartões de folha com transparência sobre um miolo escuro, mais galhos. As árvores das praças novas usam o mesmo modelo (`leafyTree`).
- A sombra do sol usa mapa de 4096 no computador.
- O chão dos bairros (o que não é rua, água nem parque) é cinza urbano levemente quente (`#b9b4aa`), como cimento e quintal no satélite, com manchas verdes suaves de árvore de quintal. Numa faixa de ~30 m na beira dos rios e da maré o chão é verde-escuro de mangue. A areia fica só onde o OSM marca `sand` (praias).
- As nuvens somem aos poucos perto do horizonte, sem a linha reta que aparecia antes.

## Rua: meio-fio, calçada, lojas e faixas (`src/rua.js`)
- **Meio-fio e calçada** (0,15 m de altura) dos dois lados de toda pista de carro, de residencial para cima. A calçada só existe onde o meio dela não cai em outra pista (bit `DRIVE`) nem na água, então não atravessa cruzamento; entre duas pistas vira canteiro estreito. Via de serviço, ponte, túnel e morro ficam sem.
- **Piso**: pedra portuguesa (textura gerada, 2 m × 2 m) nas avenidas; nas ruas de bairro cada lote de ~9 m sorteia o seu: ladrilho vermelho, cimentado, cerâmica bege ou pedra. O meio-fio é de concreto claro.
- **Térreo comercial**: fachadas viradas para a pista ganham loja por vão do atlas, com letreiro em caixa (nomes inventados: "Bar Arretado", "Tapiocaria Beberibe"…), toldo listrado inclinado com bandô e, nos de comida, mesa de plástico com quatro cadeiras na calçada (às vezes com guarda-sol). Chance por tipo de via: 85% nas primárias, 60% nas terciárias, 12% nas residenciais. Prédio com nome, com lugar do mapa a menos de 14 m ou que já ganhou placa em `places.js` fica de fora. Os letreiros têm brilho para a noite (`shops.setNight`), que só aparece se a noite voltar ao jogo.
- **Calçada colada na fachada**: onde o prédio do OSM encosta na pista ou entra nela (parede a menos de meia pista + 0,6 m do eixo), nas ruas terciárias para cima e em toda loja, uma faixa de 1,6 m de calçada corre junto da parede, com meio-fio na borda, passando 0,3 m das quinas. Assim as lojas não dão direto no asfalto. `groundY` também conhece essas faixas.
- **Fachadas com relevo** nas avenidas (secundária para cima) e em toda loja: peças 3D coladas na parede, alinhadas com o que o atlas pinta em cada variante. Sobrado: peitoril, faixa entre andares, cornija e platibanda no topo, sacada de ferro na porta-balcão (grade com textura de balaústres). Prédio moderno: laje saliente em cada andar, peitoril, ar-condicionado de janela saindo da parede e marquise sobre o térreo quando não há loja. Casa: peitoril, varandinha com grade e platibanda. O detalhe por janela vai até o 6º andar; as faixas, até o 12º. São ~1,8 milhão de vértices no total, em blocos que somem a 650 m.
- **Rua arborizada** (`src/trees.js`): nas ruas com calçada, árvores em fileira a ~0,8 m da guia, a cada 9–11 m nas avenidas e 13–17 m nas ruas de bairro, longe da esquina e com folga até a parede. Cada uma tem canteiro de terra com moldura de concreto na altura da calçada. Calçadão, rua de pedestre e o resto seguem com o espaçamento antigo.
- **Carros estacionados** (`src/traffic.js`): perto do jogador ficam até 26 veículos parados. Em rua de bairro, terciária e secundária, 60% são carros em paralelo junto ao meio-fio; os outros são motos e bikes de bico para a guia. O trânsito passa do lado sem frear, e dá para roubar o carro como as motos.
- **Mobiliário urbano** (`buildFurniture` em `src/rua.js`):
  - **Semáforo** em cada faixa dos cruzamentos de avenida (secundária para cima): poste na calçada à direita de quem chega, braço até a faixa da direita e grupo focal com ciclo de 30 s (12 s verde, 3 s amarelo e 15 s vermelho; as ruas na outra direção ficam ao contrário). ~6 mil no total.
  - **O trânsito respeita o semáforo**: `world.stopAhead(x, z, fx, fz)` dá a distância até a linha de parada de um sinal fechado à frente (até 30 m, só para quem vem por aquele braço). O carro freia antes da faixa; no amarelo, quem já está a menos de 9 m passa. Quem espera o sinal, ou está na fila atrás de quem espera, não conta como preso, então não "fura" o carro da frente. Viatura e jogador não param.
  - **Placa azul com o nome da rua** numa esquina de cada cruzamento, uma placa paralela a cada rua ("AV. CONDE DA BOA VISTA"). Cabem 511 nomes num atlas de 2048 px: só avenidas e ruas terciárias para cima, as primárias primeiro.
  - **Ponto de ônibus** a cada ~380 m nas avenidas, alternando o lado: cobertura, painel, banco, totem com a placa amarela "PARADA DE ÔNIBUS" e lixeira laranja.
  - **Fiação** (`buildStreetLights` em `world.js`): dois fios com barriga entre postes seguidos do mesmo lado da rua, fora das pontes; somem a 600 m.
  - `window.__mobilia` guarda amostras de placas e paradas para depuração. Custa ~120 ms de CPU na montagem em fatias.
- **Faixa de pedestre** nos cruzamentos onde chega uma rua terciária ou maior, em cada braço com 6 m ou mais, logo depois da esquina e só onde as duas pontas dão em calçada. Tinta gasta pela foto do asfalto.
- **Gente sobe no meio-fio**: `world.groundY(x, z)` soma a altura da calçada ao relevo; jogador e pedestres usam essa altura. O brilho dos postes subiu para ficar acima da calçada.
- **Medição (19/11, máquina carregada)**: `?semrua` na URL desliga todo o detalhe de rua. Comparar páginas carregadas em momentos diferentes não serve (o carregamento variou de 7,5 s a 50 s e o quadro de 20 a 57 ms entre rodadas iguais). Ligando e desligando a rua na mesma página, quatro vezes intercaladas, a diferença ficou dentro do ruído: vista de rua 31,7 ms com e 31,7 ms sem; avenida vista de cima 33,9 contra 35,2 ms; vista alta 42 contra 39 ms. Tirar a sombra das 2.228 peças da rua também não mudou nada (31,8 ms). Na vista de rua o detalhe soma 72 malhas visíveis (~263 mil vértices) às ~2.700 da cena. O detalhe de rua não entra no carregamento: é montado depois que o jogo abre.
- **Peso**: tudo em blocos de 400 m que somem com a distância (calçada a 1,1 km, faixa a 700 m, lojas a 650 m). A montagem acontece depois que o jogo abre, em fatias de ~8 ms entre os quadros, então não entra no carregamento: `window.ruaTimes` mostra o tempo de CPU (`trabalho`, ~0,3 a 0,6 s) e o tempo até terminar (`total`). `window.__lojas` e `window.__sacadas` guardam amostras (x, z, normal, rua) para depuração.

## Carros, ônibus e motos
- **Ônibus** refeito: perfil com caixas de roda e frente arredondada, janelas com colunas, para-brisa inclinado, duas portas do lado direito, retrovisores, ar-condicionado no teto, faixas da empresa e letreiro de LED âmbar com linha e destino (TI Joana Bezerra, Derby, Casa Amarela…).
- **Carros**: colunas A e C pintadas e friso da janela, para o vidro não parecer um bloco só.
- **Moto**: tanque arredondado, carenagem do farol, para-lamas e tampas laterais.

## Pontes: só sobre a água
O traçado das pontes no OSM continua por terra até o cruzamento da margem. Guarda-corpo, pilares, lampiões e estátuas só aparecem nos trechos com água embaixo ou do lado. Antes, a grade da Ponte Maurício de Nassau atravessava a Av. Martins de Barros.

## Prédios que eram caixas genéricas
- **Igrejas** (gerador barroco): Capela Dourada (Ordem Terceira de São Francisco) e Basílica Sagrado Coração de Jesus.
- **Prédios históricos** (gerador neoclássico): Câmara Municipal do Recife e Convento do Carmo.
- **Quartel do Derby** (1924): mantém o contorno real, com pátios, pintado de amarelo, e ganha torre com relógio e cúpula virada para a Praça do Derby.
- **Mercados públicos de ferro** (mesmo desenho do Mercado de São José): Encruzilhada, Madalena, Afogados, Cordeiro, Areias e Casa Amarela. O telhado é limitado para os grandes não virarem hangar.
- **Mercado da Boa Vista**: casa térrea em volta do pátio aberto, com arcadas para dentro e para fora e mesas de bar no pátio.
- **Geraldão** (Ícaro de Castro Mello, 1970): ginásio redondo de concreto com cúpula baixa, faixa de vidro e nervuras.
- **Parque 13 de Maio**: lago com pontinha em arco e coreto.
- **Parque das Graças**: deque de madeira na beira do Capibaribe com bancos.
- **Praça do Derby**: lago com ilhota de coqueiros.
- Cores e detalhes são aproximados; a pesquisa trouxe datas e arquitetos, mas quase nada de fachada.

## Refeitos a partir de fotos (`src/marcos.js`)
As fachadas são texturas desenhadas em canvas: uma célula (um vão por um andar) que se repete pela parede.
- **Museu do Homem do Nordeste**: bloco modernista de dois andares, com térreo envidraçado e pilotis, faixa de vidro em cima, laje branca em balanço, painel de cerâmica terracota com arcos verdes e parede laranja. Na frente ficam a placa de concreto no chão e a maria-fumaça.
- **Fundação Joaquim Nabuco**: palacete cinza-azulado com pilastras brancas e venezianas azuis, porta e janela em arco com sacada, platibanda com ameias e brasão, muro de azulejo, escadaria e palmeiras imperiais.
- **Biblioteca Pública do Estado**: caixa com brises verticais de alumínio e térreo de vidro, parede de tijolinho com o painel redondo, escadaria, totem com o emblema e palmeiras.
- **Hospital da Restauração**: lâmina de 12 andares com grelha de concreto branco e faixas azuis, letreiro e "HR" no topo.
- **Hospital Santa Joana**: faixas de vidro escuro entre lajes brancas, torre de pedra com o "SJ" e o heliponto pintado.
- **Memorial São José**: embasamento com aletas, vidro espelhado num pórtico prateado com a estrela, marquise com o letreiro azul.
- **Real Hospital Português**: torre de vidro cinza com faixas e o bloco branco de janelas em fenda com "DESDE 1855", mais a marquise do "Acesso de Pedestres". Saiu do gerador neoclássico.
- **Shopping RioMar e Shopping Recife**: o contorno do OSM extrudado em branco liso, sem janela de prédio. O RioMar tem o bloco de vidro da entrada com palhetas marrons, o "JCPM", o letreiro com as ondas e a cúpula verde; as torres do RioMar Trade Center ganharam altura. O Shopping Recife tem a entrada com letreiro, o totem do disco vermelho, o silo e as casas de máquinas. Os edifícios-garagem ficaram com faixas de vão aberto.
- **Ponte Estaiada da Via Mangue**: mastro em "A" que vira um fuste só e se abre em duas pontas, com o leque de estais até a pista curva do viaduto.
- **Av. Agamenon Magalhães**: o canal do meio já vinha do mapa; entram as fileiras de árvores nas duas margens, entre a água e as pistas e fora da ciclovia.

## Orla, Pina e centro (`src/orla.js`)
- **Pátio de São Pedro**: casario colorido de térreos e sobrados em volta da Concatedral de São Pedro dos Clérigos, com mesas de bar e bandeirolas.
- **Soparia** (Pina, 1992–1999): o boteco de Roger de Renor onde se juntava a turma do manguebeat.
  - Letreiro pintado, caranguejo na parede, mesas e um palquinho com alfaias e guitarra.
  - O endereço exato não foi achado; fica perto do Polo Pina.
- **Edifício Holiday** (1957, 17 andares em curva, 476 apartamentos): peitoris corridos em cada andar, toldos das lojas no térreo e letreiro no topo.
- **Edifício Acaiaca** (Delfim Amorim, 1958): lâmina horizontal de 11 andares sobre pilotis, empenas de azulejo azul e branco, varandas corridas e peitoris ventilados.
  - A posição na Av. Boa Viagem é aproximada.
- **Primeiro, Segundo e Terceiro Jardim de Boa Viagem**: gramado, coqueiros, parquinho, academia ao ar livre e bancos.
  - O Segundo Jardim está pelo endereço (Av. Boa Viagem, 1590); o Terceiro é o do OSM; o Primeiro é aproximado.
- **RioMar**: rampa helicoidal da ciclovia e arcos brancos na passarela.
- **Shopping Recife**: caixa branca maior; os dois shoppings já tinham letreiro.
- **Cais José Estelita**: os armazéns de tijolo com telhado de duas águas, entre a avenida e a Bacia do Pina, ao lado das torres novas que o OSM já tem.

## O rio do Recife Antigo (`src/rio.js`)
- **Barqueiros do Marco Zero**: dois barcos de madeira com toldo listrado, barqueiro na popa e passageiros de colete.
  - Saem dos trapiches do cais até o molhe do Parque das Esculturas de Francisco Brennand: 10 s atracados, 45 s de travessia.
  - Perto do trapiche com o barco atracado, **F** paga R$ 5 e o jogador atravessa sentado no barco.
- **Flesheiros**: meninos que mergulham do cais do Marco Zero e do guarda-corpo da Ponte Maurício de Nassau.
  - Saltos: mortal pra trás, mortal pra frente, mortal duplo, parafuso, bomba, anjo e carpado.
  - Cada mergulho levanta um borrifo. Depois eles nadam de volta e sobem.
  - Alguns amigos ficam sentados na beira torcendo.
  - Quando o jogador está perto, a galera grita o nome do salto.
- **Galo da Madrugada**: o galo gigante do maior bloco de carnaval do mundo, numa base listrada nas cores do frevo, no rio ao lado da Ponte Duarte Coelho.
  - Tem corpo dourado, crista, asas e um leque de penas coloridas.
  - Luzinhas acendem à noite.
- **Pontes** (`buildBridges` em `classics.js`): cornija na borda da laje e pilares com talha-mar no rio.
  - Maurício de Nassau, Duarte Coelho, Princesa Isabel e Velha: balaústres brancos com pilastras e lampiões de ferro de duas lanternas.
  - Boa Vista: gradil e treliça de ferro.
  - Doze de Setembro (a Giratória): viga de aço.
  - Demais pontes: mureta de concreto com tubo.
  - Pista dupla e calçada separada não ganham guarda-corpo no meio.

## Colisão
- Grade de 1,5 m (`src/world.js`): prédios do OSM, casario gerado, água e troncos de árvore.
- Modelos feitos por código (`src/collide.js`): cada peça carimba a sua projeção no chão.
  - Fica de fora o que começa acima de 2,2 m (cornijas, coberturas, letreiros) e o que é raso (gramado, espelho d'água).
  - Bloqueiam torres, colunas, chafarizes, estátuas, barracas, esculturas, arquibancadas, palmeiras, guarda-sóis e os ~17 mil postes.
- A pé, carros andando, estacionados e viaturas bloqueiam (retângulo do carro com 0,3 m de folga). Se um carro parar em cima de você, dá para sair.
- Carro contra carro, inclusive viaturas: retângulo contra retângulo, separando pelo menor eixo, em vez de um círculo de 2,6 m.
- O carro (do jogador e das viaturas) confere o contorno inteiro, com quinas, laterais e frente, e não só a linha do meio. Não raspa mais por dentro de postes, árvores e paredes.
- O corpo do jogador a pé tem 0,3 m de raio. Pedestres, plateias, dançarinos, banda e marisqueiras são obstáculos a pé e de carro.
- Pedestres esperam o jogador sair da frente. Não atravessam prédio, objeto nem água: esperam e, se continuar bloqueado, mudam de caminho.
- O trânsito freia para quem atravessa a rua na frente dele.

## Câmera
- Fica atrás do personagem e olha para onde ele olha (a pé e dirigindo).
- Mexeu o mouse ou arrastou no celular: ela fica onde você deixou por ~1 s e depois volta.
- Andando para trás (na direção da câmera) ela não persegue, para não ficar girando.
- Prédio no caminho: a câmera chega mais perto do personagem em vez de atravessar a parede.

## Carregamento
- Cerca de 5,3 s localmente (eram ~6,0 s). O tempo de cada etapa fica em `window.loadTimes`.
- O que mudou:
  - grade de colisão em duas passadas, com até três camadas por canal de cor;
  - votação do mar numa grade de 3 m (4x menos células);
  - casario gerado com teste rápido de cinco pontos e o teste barato primeiro;
  - bairro mais próximo guardado por quadrado de 40 m;
  - centro de cada prédio calculado uma vez;
  - telhado de quatro cantos sem triangulação completa;
  - mapa baixado junto com as fotos.
- Prédios gerados (`b.infill`/`b.gen`, de `infill.js`) são só a caixa com textura: não passam pelo teste de fachada nem ganham loja, relevo ou calçada colada. Em `buildBuildings`, as cores são convertidas uma vez só, a chave de bloco é numérica e as listas fixas saíram do laço. `window.predioTimes` mostra quanto cada parte da etapa "Levantando os prédios" leva (ms). Medido num momento em que a máquina estava calma (19/11): 189.878 prédios (101.476 gerados), `buildBuildings` 0,6 s, etapa inteira 1,1 s e carregamento completo 7,1 s. Com a máquina carregada os mesmos números ficam 5 a 10 vezes maiores.
- Casario gerado (`infill.js`, dentro de `pruneMarcos`), 20/11: de 2,7 s para ~1,1 s no Recife inteiro, com exatamente as mesmas 101.551 casas e os mesmos quintais (conferido por hash das coordenadas). A grade de ocupação usa lista de arestas ativas nos polígonos grandes e `fill` nas faixas (1,23 → 0,33 s); a rua mais perto usa chave numérica e distância ao quadrado; o teste de mata olha a classe do ponto antes da fração no raio. `data.infillMs` e `data.infillOccMs` guardam os tempos. A etapa "Marcando ruas e quarteirões" caiu de 5,2 para 3,5 s e a carga completa sem janela, de 12,9 para 11,0 s.
- Relevo dos morros (`terrain.js`), 20/11: cada célula da grade só calcula o ruído do contorno dos morros a menos de R/0,85 dela (mais longe a encosta já é zero). Grade idêntica (hash dos 2.064.035 valores), de ~1,25 para ~0,45 s no Node.
- Malhas dos marcos e das comunidades (`src/compactar.js`), 20/11: `compactGroup` passa por um grupo já montado e cada malha grande (≥ 300 vértices, usada por um objeto só e com menos de 4 km de lado) vai para um filho com posição em Int16 (com `position = centro` e `scale = meia-extensão`), normal em Int8 e uv em Uint16 quando cabe em 0–1. O objeto original fica intacto, então quem o anima continua funcionando. A cópia do JS é solta depois de enviada à placa de vídeo. Nos marcos foram 376 malhas, de 107,8 para 49,9 MB; nas comunidades o ganho é pequeno (6,6 → 2,5 MB). `?semcompactar` desliga, para comparar.
- Online, o que mais pesa é baixar o `recife.json` (15 MB). Servido com gzip ou brotli (padrão na Vercel e na Netlify), cai para alguns MB.

## Mesma cidade a cada carga (`src/semente.js`)
As montagens que carimbam a grade de colisão e sorteiam alguma coisa (coqueiro, barraca, gente, posição) usam um sorteio com semente fixa enquanto rodam: `comSemente(seed, fn)` troca o `Math.random` por um gerador fixo e devolve o original no fim. Valem para `buildLandmarks` (que inclui o `classics`, a orla, a boemia e os lugares), `buildCulture`, `buildRio` e `GenteDaRua`.

Antes, os coqueiros da orla e outras peças mudavam de lugar a cada carga. A grade mudava com eles, e com ela as lojas, as mesas e os semáforos que a rua monta depois (4.338, 4.366 e 4.380 semáforos em três cargas). Agora três cargas com `?hashgrade` dão o mesmo `window.cidadeHash`: grade 1227254768, com 4.352 semáforos.

O que sorteia depois da montagem (animação, falas, trânsito) continua aleatório.

## Mapa do município inteiro (preparação em `world.js`)
- **Grade de colisão**: a célula é 1,5 m enquanto a grade couber em ~80 milhões de células; num mapa maior ela cresce (no município inteiro, ~2,4 m e ~72 MB). Os módulos leem `grid.RES`, não uma constante.
- **Fora do município** (`meta.limit`, anéis em metros do jogo): rasterizado a 8 m por pixel. A terra de fora ganha o bit `OUT` (16, livre depois de consolidar a grade): bloqueia andar e dirigir (`blocked` e `isSolid`), mas o mar continua livre. O chão de fora é verde-acinzentado neutro.
- **Textura do chão**: até 4096 px; num mapa com mais de 16 km, o lado maior vai a 6144 px se a placa aguentar.
- `?limiteteste` inventa um contorno (círculo de 3 km em volta do Marco Zero) no mapa atual, para testar esse caminho.
- **Costa com ponta solta**: o extrato do município corta a linha de costa em Olinda e em Jaboatão, longe da borda do mapa, e o mar dava a volta pela ponta e alagava o interior (Várzea, Nova Descoberta). Agora cada ponta solta (de trecho com mais de 300 m) é esticada na direção do último ~1 km de costa até sair do mapa. A linha também engrossa com a célula (`max(2,5 m, 1,5 × RES)`), para não abrir furo na diagonal. No mapa padrão a costa já encosta na borda, e nada muda.
- **Tempo da grade**: `window.gradeTimes` dá os ms de cada parte do desenho do chão e da marcação de ruas (`agua_costa`, `mar`, `predios_ms`, `pruneMarcos`, `ruas`, `predios_grade`, `limite`, `consolida`, `textura_chao`, `casario_gerado`). No município inteiro, com a máquina calma: grade e chão ~2,4 s; o casario gerado dentro de `pruneMarcos` ~2,7 s; carga total ~12 s; heap ~1,3 GB.

## Altura dos prédios (GHSL)
- No OSM, só ~1% dos prédios do Recife tem altura; o resto era chute por área e tipo, e muito prédio de apartamento virava sobrado.
- `public/data/altura-ghsl.json`: altura média dos prédios em células de 100 m, tirada da camada GHS-BUILT-H 2018 (R2023A) da GHSL, Comissão Europeia (JRC), licença CC BY 4.0. Gerada por `scripts/ghsl-altura.py` (Python puro, sem biblioteca) a partir dos quadros GeoTIFF em `data/ghsl/`:
  `python3 -I scripts/ghsl-altura.py public/data/recife-full.json public/data/altura-ghsl.json data/ghsl/*R10_C15.tif data/ghsl/*R11_C15.tif`
- Em `defaultHeight` (world.js), só para prédio sem altura no OSM, fora do morro e fora dos tipos baixos (casa, igreja, escola, hospital, galpão…): se a maior média entre a célula e as vizinhas passa de 12 m, planta de 300 a 2.500 m² vira torre (0,9 a 1,7 × a média, de 15 a 110 m) e planta de 160 a 300 m² às vezes vira prediozinho de 3 a 4 andares. A orla de Boa Viagem continua com a regra própria.
- No morro a GHSL confunde ladeira com altura (Alto José Bonifácio dá 24 m de média), por isso lá ela não vale.
- **Dois quadros**: R10_C15 (até a latitude −8,10) e R11_C15 (Boa Viagem, Imbiribeira, Ibura e o resto do sul). Com os dois, o município inteiro tem dado.
- Bairro misto (média da GHSL de 10 m ou mais: Casa Forte, Poço, Parnamirim): planta residencial de 500 a 2.500 m² vira edifício de 18 m para cima, mais alto quanto maior a média. Casa no Recife quase nunca passa de 400 m² de planta.
- Lugar baixo (média abaixo de 10 m: Várzea, Cordeiro): prédio sem altura no OSM não passa de 1,5 × a média (mínimo 7 m), nem pelo chute de tipo e área. Igreja, orla de Pina e Boa Viagem e morro ficam de fora (`defaultHeight` → `guessHeight` em world.js).

## Chão pela cobertura do solo (WorldCover)
- Com `data.cobertura` (ESA WorldCover 10 m, CC BY 4.0, ver `src/cobertura.js`), a textura do chão pinta mata (verde-escuro), campo (verde-claro), terra (bege), brejo e mangue onde eles existem de verdade, mesmo sem polígono no OSM. Área construída e água ficam como estavam.
- A cobertura é amostrada numa grade de 9 m e esticada com suavização. Não pinta sobre célula de água da grade. Custo: a textura do chão continua em ~0,8 s.
- Sem a cobertura (`?semcobertura`), voltam as manchas verdes sorteadas e a faixa de mangue na beira da água.

## Prédios reais que faltam no OSM (Microsoft)
- `public/data/predios-ms.bin` (3,8 MB; 2,4 MB comprimido, contra 4,3 MB do JSON de antes): 138.324 contornos reais dentro do município que não encostam em prédio do OSM, tirados da Microsoft Global ML Building Footprints (2026-02, ODbL). Gerado por `scripts/ms-predios.py` a partir de `data/msbuildings/recife-211003132.csv.gz` (63 MB, fora do jogo); o formato está descrito no topo do script. O JSON antigo, legível, ficou em `data/msbuildings/predios-ms.json` (fora do jogo); `--de-json` converte um no outro.
- Entram em `loadWorld` antes do casario gerado (`infillCity` só ocupa o que sobrar): os gerados caíram de ~172 mil para ~90 mil. Ruas como a Silveira Lobo, que no OSM só tinham um prédio, agora têm os contornos de verdade.
- Ficam com `b.ms`: quando dão para a pista, ganham loja, toldo, relevo e calçada colada como os do OSM (`?semlojams` desliga). Valem como prédio para as comunidades e para a altura (`defaultHeight` + GHSL). A base não traz altura no Brasil. Com eles, as lojas de rua passaram de ~22,9 mil para ~34,5 mil; custo medido de ~+100 a 150 MB de heap e ~1 s a mais na montagem da rua.
- `?semms` desliga. Custo medido no mesmo navegador: carga de ~12 s para ~17 s; heap depois de jogar ~2,4 GB → ~2,8 GB.

## Colisão dos prédios (correção)
- `rasterLayers` desenha até 3 camadas por passada (uma por canal de cor). A marcação de ruas tinha 4 camadas (rua, pista, aeroporto e prédios), e a quarta, a dos prédios, nunca entrava na grade: só ~1% da área construída era sólida, e dava para atravessar quase todo prédio a pé ou de carro. Agora os prédios têm passada própria (de ~2,9 para ~73 km² sólidos), e `rasterLayers` recusa mais de 3 camadas.
- Efeito colateral esperado: semáforos, placas, pontos de ônibus e postes que caíam dentro de prédio deixaram de ser postos (ex.: semáforos de ~5.600 para ~4.400).
- `window.predioTimes` mostra também `fachadas` (paredes viradas para a pista) e `fachadasMs`.

## Carga mais rápida (grade e prédios da Microsoft)
Perfil da carga do município inteiro (Chrome sem janela, `node` com o protocolo de depuração): ~13 a 15 s no total, conforme a máquina. Os maiores pedaços são o casario gerado (`infill.js`, ~2,6 s dentro de `pruneMarcos`), os laços pela grade de 80 milhões de células e a leitura de volta dos desenhos em canvas (`getImageData`).
- **Prédios na grade sem canvas**: a passada de prédios agora marca a grade direto em JS, por varredura de linhas, em vez de desenhar 380 mil contornos no canvas e ler o mapa inteiro de volta: de ~0,68 s para ~0,33 s (`predios_grade`). O canvas marcava também a borda meio coberta (antisserrilhado), deixando a parede uma célula mais grossa que o contorno; uma margem de 0,75 célula imita isso: 11,29 milhões de células sólidas contra 11,39 milhões de antes (−0,9%), para os becos, as calçadas e os pedestres continuarem como estavam. `?predioscanvas` volta ao caminho antigo; `?margem=0.5` muda a margem; `?contarsolido` põe a contagem em `gradeTimes.celulas_solidas`.
- **Mar em menos passadas**: a grade grossa da costa é marcada na própria leitura do canvas da água, e as regiões que votaram mar viram água na consolidação, em vez de duas varreduras a mais pela grade inteira: `mar` de ~0,5 s para ~0,32 s. A grade final saiu idêntica, bit a bit (`?hashgrade` põe um hash da grade em `gradeTimes.hash`).
- **Prédios da Microsoft em binário** (`predios-ms.bin`): 1,9 MB a menos para baixar. No computador local quase não muda o tempo, porque o arquivo já chegava antes do mapa principal (`recife-full.json`, 7 MB comprimido); pela internet, a banda é dividida entre os dois e o ganho aparece. A grade final saiu idêntica à do JSON.
- **Segunda rodada** (comparada alternando versão antiga e nova na mesma máquina, com o mesmo `?hashgrade`):
  - consolidação da grade: o "fora do município" é calculado uma fileira inteira de cada vez (a grade de 8 m só muda a cada ~3 fileiras), ~595 → ~490 ms;
  - textura do chão: ruído e água um pixel por palavra (Uint32), com tabela de soma já limitada a 0..255, ~620 → ~360 ms;
  - placas (`places.js`): a Rua da Aurora só mede a distância dos prédios dentro da caixa dela (antes, meio milhão de prédios × todos os trechos), e os índices de prédios e ruas usam chave numérica em vez de texto 'x,z', ~370 → ~93 ms;
  - carga total ~10,7 → ~9,9 s.
- O que sobra de maior é o casario gerado (`infill.js`) e o próprio `recife-full.json` (27 MB, 7 MB comprimido), que poderia virar binário do mesmo jeito.

## Comparação com fotos reais (21/11)
Fotos do jogo (Chrome sem janela, câmera livre, 11h30) lado a lado com fotos do Google Imagens do Marco Zero, da Rua do Bom Jesus, da orla de Boa Viagem, da Ponte Maurício de Nassau e da Praça de Casa Forte. Mudou (world.js e textures.js):
- **Altura típica pelo OSM** (`localHeight`): onde há 8 ou mais prédios com altura marcada em volta (3 × 3 células de 100 m), vale o 75º percentil deles. Ela entra no lugar da GHSL quando é menor, e nada sem altura passa de 1,6 vez ela (mínimo 12 m). No Bairro do Recife a GHSL diz 26 m, mas os 111 prédios marcados no OSM ficam em 13 m: a Rua do Bom Jesus e o entorno do Marco Zero deixaram de ter torres de 15 a 25 andares no meio do casario. Fora do centro quase ninguém marca altura, e a regra não entra.
- **Torres claras**: na orla as torres são de reboco branco ou creme. Paleta própria (`TOWER`), material ~12% mais claro, fundo da varanda claro e a variante de pele de vidro trocada por parede com três janelas (textures.js, `tower`).
- **Torre de apartamento fora da orla**: prédio residencial de 8 andares para cima vira `tower` (varanda, sem loja no térreo) em qualquer bairro, menos no centro antigo (onde o OSM marca alturas e os prédios altos são comerciais). Lojas de rua: ~38,7 mil → ~36,4 mil.
- **Cor da água por lugar** (`waterTint`): mar raso perto da praia verde-turquesa, mar fundo azul, rio e bacia verde-barrento. No OSM do Recife os rios não são polígonos (a linha de costa sobe por eles), então a separação é pela forma: mar aberto é água a mais de ~550 m de terra; o que fica longe dele, ligado só por passagem estreita, é rio.
- **Rua de pedra de parede a parede** (Rua do Bom Jesus, Poço da Panela: `r.cobble`): a faixa de pedra ganha a largura das duas calçadas que a rua teria (+4,4 m, world.js `buildRoads`) e a calçada colada na fachada não sai nela (rua.js).
- Ficaram com a outra sessão: a Ponte Maurício de Nassau (classics.js) é uma ponte reta de grade branca; a real tem arcos, postes ornamentados e estátuas nas cabeceiras. A Rua do Bom Jesus de verdade é calçada de ponta a ponta, sem calçada alta.
- Carga 9,0 s, heap ~555 MB; duas cargas com `?hashgrade` iguais (grade 1227254768; a contagem da rua mudou com as torres).

### Segunda leva (21/11): Jaqueira, Conde da Boa Vista, Rua da Aurora, calçadão de Boa Viagem, morro
- **Bairro de torres**: nas fotos, o Parque da Jaqueira tem um anel de torres de 25 a 40 andares; no jogo eram prédios baixos. A GHSL dá 13 a 16 m de média em Graças, Jaqueira, Aflitos e Parnamirim, porque mistura as torres com as casas. A regra antiga dava a esses bairros só 14 a 27 m (menos que a regra do bairro misto, de 10 a 12 m de média). Agora, com média de 12 m ou mais, planta residencial de 500 a 2.500 m² vira torre de 30 m para cima (`30 + (H − 12) × 3 + sorteio × 50`, até 120 m), e metade das plantas de 300 a 500 m² também (torre fina). No centro antigo continua valendo o teto pela altura do OSM.
- Duas cargas com `?hashgrade` iguais: grade 2785333340, rua "197398,15341,34190,5368,19212,5916,4329,1842,200". Carga ~10 s, heap ~540 MB.
- Achados que ficaram como proposta ou com a outra sessão:
  - Rua da Aurora: a beira do rio é cais de pedra; no jogo é rampa de grama.
  - Jaqueira: o parque é quase uma mata fechada; no jogo, gramado com árvores espaçadas (trees.js).
  - Boa Viagem (resolvido): coqueiros na orla e torres na primeira fila (outra sessão: trees.js, infill.js). No world.js, contorno sem nome (Microsoft, gerado ou `yes` do OSM) na faixa de areia some: de 8 a 150 m do lado do mar e só do começo da Av. Boa Viagem para o sul (34 contornos). A primeira versão pegava tudo a leste da avenida e apagava ~2 mil prédios do Pina e de Brasília Teimosa: corrigido, conferido em foto.

## Corredor de ônibus da Conde da Boa Vista (`buildBusCorridor` em rua.js)
- Como nas fotos: a faixa de dentro de cada pista (a do lado do canteiro) é exclusiva de ônibus, em concreto cinza, com linha branca contínua separando e "ÔNIBUS" pintado no chão a cada 60 m, lido de frente por quem vem na faixa (letras esticadas no sentido da pista, como a pintura de verdade).
- Estações cobertas no canteiro a cada ~420 m, fora dos cruzamentos: plataforma elevada (35 cm) com faixa tátil amarela, colunas no meio, cobertura com a faixa azul do Grande Recife, vidro no meio e banco dos dois lados. São 4 ao longo da avenida.
- O lado do canteiro é achado pela outra pista mais perto; sem a outra pista ao lado (fim da avenida, alças), não há corredor.
- Monta só perto da câmera, como o resto da rua (`streetLazy`). As estações ficam em `world.busStations` e `window.__corredor` (para o trânsito usar a faixa e parar nelas).
- Trânsito e árvores (outra sessão): na avenida o ônibus anda na faixa de dentro, para 5 a 8 s em cada estação e segue; os carros ficam na faixa de fora; 40% do que nasce ali é ônibus (traffic.js). As árvores do canteiro que caíam dentro de uma estação somem quando ela monta (trees.js). A plataforma ainda não entra na colisão.

## Pontes acima do rio e cais de pedra (23/11)
- **Tabuleiro das pontes** (`buildDecks` em world.js, `setDeck`/`deckAt` em terrain.js): toda ponte sobre a água (152) sobe sobre o rio. As grandes, com nome "Ponte …" ou avenida, ficam a 2,6 m; as outras a 2,0 m; passarela sem nome a 1,4 m. A rampa é de 10% nas cabeceiras em terra, e os primeiros 14 m da ponta em terra ficam no nível da rua, então o cruzamento com a avenida da margem continua plano. A altura entra no `heightAt`, e carro, gente, câmera, poste, guarda-corpo, lampião, estátua e flesheiro sobem juntos. A grade só tem as células de 2 m onde há ponte (~33 mil). `?semtabuleiro` volta às pontes rentes.
- **Pilares e arcos** (`bridgeSupports`): sobre a água a laje tem ~1 m de espessura, com o fundo fechado, e um pilar com talha-mar fica a cada ~20 m. Nassau, Duarte Coelho, Princesa Isabel e Santa Isabel ganham arcos abatidos de pedra clara entre os pilares, com aduelas na face. Os pilares antigos de classics.js não apareciam e saíram.
- **Cais de pedra** (`buildQuays` em world.js): na Rua da Aurora, Rua do Sol, Martins de Barros e nos cais (Santa Rita, Apolo, Alfândega, Detenção), a margem do Capibaribe vira muro de pedra com limo perto da linha d'água. Em cima vai uma calçada de pedra de 3,2 m e uma mureta branca de 0,8 m. A margem é achada andando da rua até a água (até 90 m, sem prédio no caminho) e suavizada. São ~3,5 km de cais, e `?semcais` desliga.
- **Estações do corredor**: a plataforma é piso de 0,35 m (`curbHeight` em rua.js), e quem anda sobe nela. O vidro do meio não entra na grade, porque com células de 2,5 m travaria a plataforma inteira.

## Ônibus com a pintura do Grande Recife (23/11)
- Cerca de 60% dos ônibus saem com a pintura laranja da operação convencional (a frota nova, segundo o Diario de Pernambuco de out/2026). A saia laranja vai até embaixo das janelas, com frente e traseira laranja e um friso branco. O resto é a frota antiga: branco com a faixa da empresa e o friso amarelo. Fica em `models.js`, nas peças `saia` de `busGeos`; quem pede uma cor ao `makeVehicle` não entra no sorteio. A cor do BRT não aparece em nenhuma fonte, então ficou de fora.
- A noite não foi mexida: o relógio do jogo só vai das 6h às 17h05.
- **Vizinhos no horizonte** (`src/olinda.js`): é cenário de longe fora do limite do município, onde antes era tudo mar. Ninguém anda lá, e a grade continua fora.
  - **Olinda:** a costa vai do Istmo ao Janga, e as colinas do sítio histórico ficam verdes, com a Sé a ~42 m. Tem casario colorido em volta da Sé e torres brancas em Bairro Novo, Casa Caiada e Rio Doce. Os marcos são a Sé, a Misericórdia, São Bento, São Francisco, o Carmo, a Caixa d'Água com o mirante e o farol.
  - **Piedade e Candeias:** a praia de Boa Viagem continua para o sul com a parede de torres da beira-mar (50–115 m em Piedade, mais baixas em Candeias). A oeste fica o Morro dos Guararapes com a Igreja dos Prazeres.
  - **Como entra:** a costa sai das coordenadas reais, e do lado do mar a borda afunda para a água cortar a areia numa linha lisa. O casario é instanciado, com telhado de duas águas. A montagem é depois do índice de ruas, para pular ruas e prédios do OSM que já existem logo depois do limite.
  - **Neblina:** é ~3x mais longa que a da cidade. Com a de 1,25 km Olinda sumia; com mais que 3x, o casario de longe ficava mais nítido que o Recife de perto.
  - **Custo:** ~220 ms na carga. `?semolinda` desliga os dois.

## Medição (23/11, depois das pontes, cais e vizinhos)
- Carga ~9,7 s e memória ~597 MB (heap 349 MB + buffers 247 MB). Com `?semolinda&semtabuleiro&semcais`, 589 MB: as três coisas juntas custam ~8 MB.
- Fotos de conferência sem nada claramente errado:
  - **Santo Antônio (Praça da Independência):** os prédios altos batem com as alturas marcadas no OSM ali (65 prédios, vários de 40 m, o maior com 58 m).
  - **Casa Forte:** a praça com palmeiras e o anel de torres em volta.
  - **Derby e Maciel Pinheiro.**

## Fachadas das torres (23/11)
- **Quem é torre de apartamento:** prédio residencial de 24 m para cima, sem nome, vira torre (fachada de varandas) em qualquer bairro. Antes, onde o OSM marca algumas alturas (Graças, Aflitos), essas torres saíam com fachada de escritório. Só o centro comercial antigo (Recife Antigo, Santo Antônio, São José e o miolo da Boa Vista, onde o OSM marca alturas) continua com prédio modernista de escritório.
- **Cores:** a paleta ganhou bege, salmão claro e cinza-azulado ao lado dos brancos e cremes.
- **Varanda gourmet:** a quarta fachada das torres virou varanda com laje branca grossa marcando o andar, guarda-corpo de vidro, porta de correr ao fundo, jardineira às vezes e um pilar de reboco com janelinha de serviço. Antes era parede com três janelas e ar-condicionado, que da rua parecia escritório. Agora três das quatro fachadas de torre têm varanda.
- **Topo:** cada torre sorteia pela posição entre a casa de máquinas, a cobertura recuada (o duplex do último andar, na cor da torre, com beiral) ou a coroa de pilares com laje vazada. As caixas do topo agora seguem o eixo da planta (`obox`), não o norte.

## Estacionamentos (23/11)
- O mapa do jogo não tinha os estacionamentos, só as pistas de serviço entre as vagas. O chão ali saía com a grama da cobertura do solo, e o estacionamento do Shopping Recife virava faixas verdes.
- `public/data/estacionamentos.json` (132 KB) tem os contornos de superfície do OpenStreetMap (amenity=parking, ODbL), baixados do Overpass em 23/11/2026. Ficam de fora garagem coberta, subsolo e cobertura; são 859 lotes, ~212 ha.
- Cada lote vira asfalto com as vagas pintadas (`buildParking` em world.js): fileiras de 5 m dos dois lados de um corredor de 6 m, vaga de 2,5 m, alinhadas pelo lado mais comprido do lote.
- A malha fica logo abaixo das ruas, então as pistas de serviço continuam por cima. São ~5 mil triângulos numa malha só, e `?semestacionamento` desliga.

## Protagonista com corpo de verdade (26/11) — `src/protagonista.js`
- O protagonista agora tem um corpo humano com esqueleto de 65 ossos (~21 mil triângulos com cabelo e roupa), pele com relevo e animação de verdade. Ele troca sozinho entre parado, andar (a passada acompanha a velocidade), correr, no pique, no ar, dançando, sentado no barco e nadando. No carro some, como antes.
- O boneco de caixas continua existindo, invisível, porque o resto do jogo mexe nas peças dele (passinho, pulo, barco, colisão). O corpo novo é filho dele, então herda posição, giro e visibilidade. No `main.js` são três linhas: `attach` na criação e na troca de roupa, e `update` a cada quadro. `?bonecovelho` volta ao boneco de caixas.
- Avatar escolhido (avatar.js): `attach(mesh, outfit)` lê `outfit.sexo` ('m'/'f'), `outfit.skin` e `outfit.barba`, e recarrega o corpo quando algum deles muda.
  - O corpo feminino usa `Superhero_Female_FullBody` (1,66 m). Os dois arquivos de corpo já trazem olhos e sobrancelhas.
  - Cabelo da mulher: short, curly, afro e longo viram o longo; tranças viram coque; buzz vira o raspado; careca fica sem cabelo. Homem com `longo` fica com o social.
  - Barba só com `outfit.barba`, na cor do cabelo.
  - Pele (protagonista e NPCs, `tintaPele` em protagonista.js): a textura do kit é um moreno médio (~#a87450), e a textura "clara" é quase igual a ela. O tom por cima leva a luminância da pele à do tom escolhido, pela razão em linear com expoente 0,8 para o retinto não virar breu. Do matiz entra só 25% da diferença: com a razão cheia por canal, a pele clara ficava cinzenta. O galego (#e8b896) sai claro, a Dandara (#4a2e1e) retinta com o rosto visível, e os NPCs vão do #f3cfae ao #4a2f22.
- A roupa segue o save: a regata pega a cor da camisa, a bermuda a da calça, o tênis a do sapato e o cabelo a cor escolhida. O corte da barbearia vira um dos cabelos do kit: social, máquina, coque nas tranças e careca. Cacheado e black power ficam com o social, porque o kit gratuito não tem esses. Boné, chapéu de cangaceiro, óculos e sombrinha da loja aparecem no corpo novo: são as mesmas peças do boneco de caixas, copiadas e presas nos ossos. Chapéu e óculos vão na cabeça, alinhados pelo topo e pela frente do rosto e na escala da largura da cabeça nova. A sombrinha vai no peito, do lado direito.
- No passinho, o corpo novo dança uma dança só (`Dance_Loop`). Os passos com nome do passinho continuam só no boneco de caixas.
- Arquivos: corpo, cabelos e animações da Quaternius, CC0 (Universal Base Characters e Universal Animation Library, versões gratuitas). Ficam em `public/personagens/` (4,4 MB). `animacoes-jogo.glb` traz só as 16 animações que o jogo usa (2,8 MB, contra 7,6 MB do pacote inteiro). As texturas foram reduzidas a 1024 px, e a licença está em `LICENCA-Quaternius-CC0.txt`.
- A roupa (regata, bermuda e tênis) é recortada do próprio corpo, pelos triângulos cujo osso principal é o do tronco, do quadril/coxa ou do pé. A peça é inflada 1 cm e presa no mesmo esqueleto.
- `prototipo.html` (com `npm run dev`) mostra o boneco de caixas ao lado do corpo novo, com botões para cada animação e para os seis personagens da tela de início (`AVATARES` de avatar.js). Trocar de personagem refaz os dois bonecos e mantém a animação; no console, `escolhe('galego')`.

## NPCs de perto com corpo de verdade (26/11) — `src/corpos.js`
- Quem está a até ~35 m da câmera, no máximo 16 pessoas, ganha um corpo humano com esqueleto, de um conjunto de corpos reaproveitados. Há modelo masculino e feminino, sai em 42 m, e o jogador e as estátuas ficam de fora. Mais longe continua o boneco de caixas.
- **Porte:** o corpo do kit é de "super-herói". Cada NPC sorteia magro, médio ou forte (mulher: mais magras; idoso: médio). Braço e coxa ficam mais finos na espessura, com mão e pé no tamanho certo, e o tronco um pouco mais estreito. A escala vai depois da animação a cada quadro, porque os clipes trazem escala em todos os ossos.
- **Chapéu e peças penduradas depois:** se um módulo pendura ou tira algo do tronco depois que a pessoa ganhou o corpo novo (o chapéu de palha da quadrilha), as cópias nos ossos são refeitas, e o original some (antes ficava em dobro). O chapéu sobe a altura de um cabelo, porque a cabeça de caixa é medida com cabelo e a nova sem. A saia abre mais embaixo, então a coxa dança por dentro sem furar.
- **Andar de verdade:** quando a pessoa só está andando (`animatePerson` marca isso a cada quadro), o corpo novo usa as animações do kit, com parado, andar e trote pela velocidade e troca suave. Se o módulo mexe nos braços depois do passo (celular, sacola, sombrinha), esses braços continuam copiados do boneco. Dança, capoeira, sentado e outras poses especiais seguem copiadas por inteiro.
- **Em pé esperando:** quem está parado com tronco e pernas do boneco sem giro há meio segundo (fila, coral, plateia, vendedor) também usa a animação de verdade, em vez de ficar duro feito manequim. Os braços que o módulo pôs (palma, instrumento, celular) e a cabeça virada continuam copiados. Um terço do povo (sorteado pela pessoa) fica de conversa, gesticulando (`Idle_Talking_Loop`), e o resto respira na espera (`Idle_Loop`). No Marco Zero, 14 dos 16 corpos de perto passaram a se mexer; a CPU foi de ~0,9 para ~1,5 ms por quadro. `genteReal.conversando` conta quantos estão de conversa.
- **Olham pra você:** quem está parado vira a cabeça devagar para o jogador que passa a até 5 m, pela frente (até ~60° para o lado e um pouco para cima ou para baixo), e volta quando ele se afasta. Vale por cima do balanço de cabeça do módulo (o coral continua cantando), mas não quando o módulo já vira bem a cabeça para outro lado. O jogador vem de `jogadorMesh()` (protagonista.js, o último boneco que recebeu `attach`). `genteReal.olhando` conta quantos estão olhando.
- Os módulos não mudam: cada pessoa continua sendo o boneco de `makePerson`, posado pelas juntas (`userData.legL`, `armR`, `upper`, `head`…) e por `animatePerson`. A cada quadro a pose das juntas é copiada para os ossos: coxa, canela, braço, antebraço, tronco e cabeça, com o lado tirado da posição e a pose de referência do primeiro quadro de "parado". Dança, capoeira, dominó, instrumentos e o resto continuam valendo.
- Só as peças de caixa criadas por `makePerson` somem (`userData.caixas`). O que os módulos penduram depois (pandeiro, véu, moicano) continua visível, preso na junta de caixa. Boné, óculos e sombrinha da pessoa vão para os ossos, como no protagonista.
- O visual vem de `userData.look`, gravado em `makePerson`:
  - **Pele:** o tom do boneco por cima da textura (`tintaPele`, ver acima).
  - **Roupa:** uma malha só, com uma cor por região (tronco, braço, antebraço, quadril/coxa, canela, pé) num shader. A região liga e desliga conforme camisa, regata, manga, calça, bermuda e chinelo (sem chinelo, aparece o pé). Vestido e saia ganham uma saia de verdade: um tronco de cone da cintura ao joelho, abrindo embaixo e presa ao quadril, com a coxa de fora por baixo. Antes o vestido saía como maiô colado e parecia calça de longe.
  - **Cabelo:** o do kit mais parecido e na cor do boneco, com barba em ~1 de cada 5 homens.
- `userData.semCorpo = true` mantém a pessoa como boneco de caixas, mesmo de perto (a Emparedada translúcida de lendas.js). Escala e `visible` do grupo valem para o corpo novo, que é filho dele: a Comadre Fulozinha sai baixinha e some junto.
- O que um módulo põe na cabeça de caixa (`userData.head.add(...)`, depois do rosto, cabelo e barba que `makePerson` monta) também vai para o osso da cabeça do corpo novo: o véu da noiva do casamento, o moicano dos punks, o capacete do mototaxista. `head.userData.fixos` diz quantos filhos da cabeça são do próprio boneco; o resto é acessório. Se o número de peças no tronco ou na cabeça mudar depois, a cópia é refeita.
- Custo: cada corpo de perto tem ~24 mil triângulos em 6 malhas com esqueleto (corpo, roupa, cabelo, olhos, sobrancelhas, saia). Só o corpo e a saia projetam sombra (o resto fica dentro do contorno), e só até 20 m. Como malha com esqueleto não se recorta sozinha pela câmera, cada pessoa some inteira quando uma esfera de 2,5 m em volta dela sai da vista. Medido no Chrome sem janela, no Marco Zero com 16 corpos ativos: o custo caiu de ~20% para ~10% dos quadros, comparando com `?semgentereal`. A CPU gasta ~1 ms por quadro com eles (`window.genteReal.ms`).
- Pele coberta não é desenhada. Para cada combinação de partes vestidas (tronco, braço, antebraço, coxa, canela, pé), o corpo fica só com o que aparece, mais uma fileira de triângulos sob a borda da roupa para a costura não abrir. A malha de roupa também só desenha as partes vestidas. Esses índices são guardados por combinação e todos os corpos usam os mesmos vértices. A roupa projeta sombra junto com o corpo. No Marco Zero ficaram ~91 mil triângulos com esqueleto na tela, contra ~396 mil antes, e o custo caiu para ~7% dos quadros.
- Custo: ~18 MB a mais (557 → 575 MB na média de duas medições) e a mesma carga. `?semgentereal` desliga. testar-tudo: "Tudo certo" (60/60).
- Pé afundando no piso: o piso cor-de-rosa do Marco Zero (7,5 cm) e a Rosa dos Ventos (10 cm) ficam acima do chão que o jogo usa, e o tênis novo, mais baixo, sumia dentro do piso. Agora `pisoElevado(forma, altura)` (rua.js) registra pisos elevados, e `curbHeight`/`groundY` sobem neles.

## Cidade igual em toda carga
- O que entra na grade de colisão não pode ser sorteado com `Math.random`: a grade muda, e com ela mudam as lojas, as mesas e os semáforos da rua (que olham `isSolid`/`isDrive`). Sorteio de coisa carimbada na colisão vem da posição (ex.: `frac(sin(x·12,9898 + z·78,233)·43758,5453)`, como `hashf` em rua.js). Sorteio só de aparência (rotação, cor, fase de animação) pode continuar com `Math.random`.
- Postes (`buildStreetLights` em world.js): o primeiro poste de cada rua agora sai da posição da rua, não de `Math.random`.
- `?hashgrade` põe em `window.cidadeHash` o hash da grade já com tudo carimbado e a contagem da rua, quando a rua termina de montar. Duas cargas iguais = cidade igual. Com os postes sorteados pela posição e a montagem de marcos, comunidades, rio e gente da rua rodando com semente fixa (`comSemente` em src/semente.js), duas cargas dão a mesma cidade (valores atuais na seção "Segunda leva") (calçadas, faixas, letreiros, mesas, relevos, calçadas coladas, semáforos, placas, pontos de ônibus).

## Memória
- Depois que cada imagem vai para a placa de vídeo, a cópia no JS é solta (`releaseOnUpload` em `src/textures.js`): fotos, texturas desenhadas, chão e atlas de placas. Antes eram ~420 MB de imagens na memória; agora ficam ~9 MB.
- As placas usam células de 256 × 48 px: 4 atlas em vez de 15 (menos memória de vídeo também).
- Peças fixas da cidade soltam os vértices depois de enviados (carros e pessoas não, porque suas geometrias são reaproveitadas). Contornos de prédios, praças, água e costa são apagados depois de montar a cidade; ruas, bairros e lugares continuam (HUD, trânsito e bicos usam).
- Blocos de prédio compactados (`Acc.geoQ` em world.js): posição em Int16 relativa à caixa do bloco (o Mesh leva centro e escala), normal em Int8, índice em Uint16 quando cabe. A maioria dos blocos do município nunca fica visível, então o array nunca vai para a placa nem é solto. Medido com `scripts/medir-memoria.mjs` (gc forçado): buffers de 1.052 para 833 MB (−219 MB); heap de JS igual (~480 MB). `?semquant` volta ao Float32 para comparar.
- Blocos de prédio montados só perto da câmera (`buildBuildings` em world.js): na carga, cada prédio vira só números (20 por prédio + o contorno, em Float32Array por bloco de 400 m). Os vértices de um bloco são montados quando a câmera chega a 1,7 km e desmontados a mais de 2,2 km, os mais perto primeiro, até ~6 ms por quadro. As lojas de rua (`fronts`) continuam saindo na carga. `?todosblocos` monta tudo de uma vez, para comparar. Medido com gc forçado: buffers de 879 para 601 MB, total de 1.358 para 1.069 MB (no começo do dia, sem compactar nem montar sob demanda, eram 1.525 MB).
- Detalhe de rua compactado (`Mesh.geo` em rua.js): calçada, meio-fio, faixa, lojas, toldos, relevo de fachada, mobiliário e luzes dos semáforos saem com posição em Int16 relativa à caixa da malha (o Mesh leva centro e escala), normal em Int8, uv em Uint16 quando cabe em 0..1 (a calçada guarda metros no uv e fica em Float32) e cor em Uint8. O acumulador usa arrays tipados que crescem, em vez de arrays JS de números (na montagem eram ~400 MB de pico). Medido com gc forçado depois de a rua terminar de montar (município inteiro): vértices da rua de 378 para 198 MB, heap de ~1.220 para ~1.035 MB. `?semquantrua` volta ao Float32 para comparar.
- Detalhe de rua montado só perto da câmera (`lazyChunks` e `streetLazy` em rua.js). Na carga, cada gerador (calçada, faixa, mobiliário, lojas) roda uma vez inteiro: faz os efeitos de uma vez só (lista de semáforos para o trânsito, calçadas coladas para o meio-fio, contadores) e só anota quais objetos desenham em cada bloco de 400 m, sem guardar vértice. Perto da câmera (corte + 150 m), o bloco é montado rodando de novo só os objetos dele; o que eles desenham em outro bloco é jogado fora. Longe (corte + 500 m), é solto. A montagem é fatiada entre quadros (~4 ms por quadro, um bloco de cada vez).
  - Os sorteios da rua vêm da posição (`hashf`), então o bloco sai igual toda vez. `?ruacheck` confere isso na carga, bloco a bloco: 8.425 de 8.425 iguais, vértice por vértice (`window.ruaCheck`).
  - Medido com gc forçado, máquina calma, município inteiro: heap de 1.033 MB (`?ruatoda`, tudo montado) para 821 MB; buffers de 541 para 343 MB. Custo por quadro andando e se teletransportando: mediana 0,8 ms, 95% abaixo de 3 ms, máximo 5,9 ms (`?ruatempos` guarda os tempos em `window.ruaBlocos.quadros`).
  - `?ruatoda` monta tudo de uma vez, como antes.
- Grades de trabalho soltas no fim da consolidação (`coastC`, `labels`, `seaL`, `outside` e a imagem do chão em world.js). Elas aparecem dentro de funções internas, e o escopo do `loadWorld` fica vivo enquanto o jogo roda (`isSolid`, `update`…), então continuavam presas. Na faixa de pedestre, o mapa de nós é esvaziado depois da primeira passada. Medido com gc forçado: buffers de 343 para 273 MB, total de ~797 para ~730 MB; a cidade continua a mesma (`?hashgrade`).
- O que sobra de maior (perfil de alocação, gc forçado, rua montada): grafo do trânsito ~118 MB (traffic.js), objetos da cena ~47 MB (pessoas e árvores), mangue ~41 MB (infill.js), clássicos ~28 MB, árvores ~32 MB (trees.js), índice das ruas ~20 MB (rua.js, usado por gente e meio-fio). Em buffers: grade de colisão 78 MB e dados dos prédios para remontar perto da câmera 45 MB.
- Contrapartida: se o navegador perder o contexto WebGL (raro, por exemplo depois de reiniciar o driver de vídeo), a cidade não se redesenha sozinha; é preciso recarregar a página.

Mapa © colaboradores do OpenStreetMap (ODbL). Contornos extras: Microsoft Global ML Building Footprints (ODbL). Altura dos prédios: GHSL, Comissão Europeia (CC BY 4.0). Texturas fotográficas: Poly Haven (CC0).

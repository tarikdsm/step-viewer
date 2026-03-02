# STEP Viewer - Relatório Técnico e Manual

## 1. Visão Geral do Projeto

O **STEP Viewer** é uma aplicação web de ponta construída para renderizar, analisar e interagir com modelos CAD em formato `.STEP` (.stp) diretamente no navegador, sem a necessidade de um servidor de renderização pesado. A aplicação foi concebida focando em performance, simplicidade de deploy, e funcionalidades industriais (como Vistas Explodidas, Medições e Modo Aramado).

O projeto é construído em cima de:
*   **Next.js 14 (App Router)**: Fornece a infraestrutura do servidor React, páginas otimizadas e rotas de API para armazenar arquivos localmente.
*   **React Three Fiber (R3F)**: Ponte declarativa entre React e Three.js para construção da cena 3D.
*   **Three.js**: O motor de renderização WebGL nativo.
*   **occt-import-js**: Uma versão compilada em WebAssembly (WASM) do *Open CASCADE Technology*, permitindo que a pesada tarefa de transformar matrizes matemáticas de CAD em polígonos seja feita diretamente na máquina do cliente.
*   **Tailwind CSS**: Estilização da interface de usuário em um moderno tema escuro.

---

## 2. Manual do Usuário (Recursos)

A interface principal consiste em um painel Lateral (`Sidebar`) de controles à esquerda e um Canvas 3D que ocupa o resto do espaço.

### Upload e Armazenamento Otimizado
*   **Processamento Automático**: Clique em `Upload .STEP` para carregar um modelo local. Ele é traduzido em centésimos de segundo pelo WebAssembly.
*   **Arquivos Salvos (Nuvem Local)**: Após o upload, o modelo fica imediatamente gravado na pasta `/uploads` configurada no diretório raiz do Next.js. Ao recarregar a página, você verá todos os arquivos armazenados disponíveis num clique.
*   **Gerenciamento**: É possível deletar ou recarregar os arquivos anteriores diretamente através dos ícones da lista na *Sidebar*.

### Manipuladores Visuais (Sliders)
*   **Exploded View (Vista Explodida)**: Simula uma desmontagem peça por peça. Move os componentes perfeitamente em 3D, espalhando-os a partir do centro físico da montagem total do CAD.
*   **Transparência (Raio-X)**: Um controle de opacidade global permite inspecionar peças encrustadas dentro de outras cascas e superfícies sólidas.

### Ferramentas de Interação 3D
Esta aplicação possui um conjunto avançado de manipuladores físicos do cenário:
*   **Modo de Medição (Platonic Point-to-Point)**: Ative a opção de `Medidas`. Ao clicar em dois pontos distintos de um corpo sólido renderizado, o aplicativo insere âncoras esféricas em 3D guiadas pelas normais das malhas (Raycasting), e estica uma linha com a aferição precisa em milímetros (MM) colada à tela sobre do modelo.
*   **Drag & Drop (Modo Mover)**: Desabilita temporariamente a rotação do cenário, permitindo que a peça individual seja agarrada com o mouse e movida livremente pelas coordenadas (X, Y). Desativar o modo restaura a estrutura matemática original, *grudando* a bagunça de volta à montagem real da engenharia.
*   **Seleção em Área (Box Marquee)**: Ao arrastar o cursor pela tela com esse modo ativado, cria-se o familiar "Retângulo Azul" do sistema operacional. O sistema usa matemática avançada de Projeção em Tronco (Frustum) para calcular quais peças 3D colidiram por debaixo dos limites do retângulo HTML em 2D, selecionando dezenas de parafusos de uma vez só.
*   **Aramado (Wireframe)**: Alterna todos os polígonos sólidos em linhas puras, revelando a complexidade da "Mesh" de renderização que compõe componentes orgânicos e cilindros perfeitos criados pelos sistemas CAD.
*   **Captura Rápida (Screenshot)**: Obtém o buffer da placa de vídeo renderizado no WebGL na resolução nativa do momento do clique e injeta um download imediato de imagem `.png` do cenário direto sem bordas de interface.

### Árvore de Componentes (Part Hierarchy)
A parte minuciosa do projeto fica na lista inferior:
1.  Permite seleção via Clique (Segurando CTRL para múltipla seleção).
2.  Oferece controle independente e nativo de Cor via HTML Input para aplicar texturas.
3.  Olhos (`Eye/EyeOff`) para ocultar isoladamente parafusos ou faces externas obstrutivas.
4.  **Agrupamento Real (Grouping)**: Selecionar várias partes e clicar o botão de "Agrupar" cria um cluster estático de memórias. Ao ativar a *Vista Explodida*, aquelas peças não irão se afastar de seu conector, atuando como um "Superbloco" atrelado um ao outro.

---

## 3. Guia de Arquitetura e Engenharia (Para Desenvolvedores)

Se você desejar ramificar ou modificar a infraestrutura para futuras integrações (ex: migrar do armazenamento Local de pastas `/upload` do Next.js para um sistema como AWS S3), entenda estes fluxos matriciais:

### 3.1. Parsing e WebAssembly (`src/lib/stepParser.ts`)
A função magna responsável por decodificar os .STEP está em `parseStepFile`.
Não há requisições para servidores externos de engenharia. Ele isola o ArrayBuffer HTML bruto via `FileReader`, e instancializa assincronamente o `occt-import-js`. Como esta biblioteca não retorna atributos e formatos aceitos diretamente pelo React, o parser itera com um laço complexo na árvore extraindo vértices (Position), Normais e Índices de faces. Formata tudo em `BufferGeometry` do `Three.js` e compila dentro de uma interface centralizada local (`ParsedPart`) possuidora de identificadores reativos, cores hexadecimais em Float32 nativos da placa de vídeo.

### 3.2. Estratégia React Three Fiber (`src/components/Viewer3D.tsx`)
A infraestrutura renderiza peças de forma independente atreladas ao seu prop nativo. O componente iterante `<PartMesh>` engloba tudo. 
*   **Cálculo da Explosão (The Offset Math)**: É processado em Loop. Ele clona as coordenadas em Vector3 e estica a posição atual perfeitamente calculando: `(vetor subteado do eixo zero do GroupId / Length Máximo)` versus o percentual atrelado ao estado `explodedValue` vindo pela Prop Drilling direta da raiz global, sem necessidade de ferramentas complexas (Ex: Zustand).
*   **Interações Muteáveis**: Os controles `<OrbitControls>` são dependentes e reativos às bandeiras passadas (`disabled={dragMode || boxSelectMode}`). Se o usuário pressionar o botão 'Mover' vindo do componente HTML Irmão puro do DOM (o `<Sidebar>` via State da árvore `page.tsx`), a React Tree relança suspendendo a escuta do mouse da câmera, aplicando as tags de `<DragControls>` apenas sobre a geometria selecionada. 
*   **BoxSelectionManager (A intersecção de HTML <> 3D)**: Usa um componente *headless* em ThreeFiber. Ele usa `.getBoundingClientRect()` na montagem bruta, interceptando eventos limpos do ponteiro do mouse fora do Lifecycle da re-renderização sintética. No levantamento do clique ele roda um laço exaustivo via matriz da Câmera ativa (`camera.project`), checando a colisão visual (Depth buffer < 1) da Normalized Device Coordinate (NDC).

### 3.3. Roteamento de Arquivos Locais (Persistência `api/files`)
Em `route.ts`, localiza-se a API App Router pura da Vercel para infraestrutura Node nativa:
*   Faz parsing dos `FormData`, converte as submissões Multipart-Form localmente através e implementa um sistema defensivo nomeando arquivos usando o timestamp de chegada da requisição, atenuando corrupção em uploads concorrentes com filenames iguais (ex: `part1.step`). 
*   O Path (`path.basename`) previne estritamente o vazamento de Traversal Directory injection em endpoints de EXCLUSÃO e de DOWNLOAD bruto via conversão isolada de binário `Buffer.from`.

### 3.4. Práticas de Código e Comentários
Ao longo de todo o repositório foi utilizada a padronização severa das tags *JSDoc* descrevendo a infraestrutura de dados em inglês detalhado e explicações sequenciais inline orientando o ciclo de vida matemático.

---

*Projeto construído no formato Next.js / TypeScript App Router para demonstração industrial 3D.*

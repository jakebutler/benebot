(function () {
  "use strict";

  var state = {
    language: "en",
    concepts: [],
    graph: null,
    selectedConcept: 0,
    selectedLayer: 0,
    mathBroken: false,
  };

  var layerTranslations = {
    "layer:experience": {
      name: "Experiencia de la paciente y del personal",
      description: "Páginas de Next.js, estilos compartidos y componentes accesibles presentan la factura sintética, la conversación bilingüe, la aritmética determinista y la cronología visible para el personal.",
    },
    "layer:api": {
      name: "API autenticada del servidor",
      description: "Las rutas de Next.js aplican la sesión firmada y exponen solo las operaciones cerradas de factura, beneficios, recursos, seguimiento, resumen y token temporal de Deepgram.",
    },
    "layer:domain-core": {
      name: "Núcleo determinista de facturación y confianza",
      description: "La normalización, la conciliación, los contratos, las sesiones JWT y los errores saneados mantienen deterministas las explicaciones financieras y cierran el acceso ante fallos.",
    },
    "layer:conversation": {
      name: "Política bilingüe de voz y conversación",
      description: "La configuración de Deepgram, el diccionario en inglés y español, los requisitos de herramientas y la ruta de texto determinista gobiernan toda conversación.",
    },
    "layer:integrations": {
      name: "Integraciones de salud y flujo FHIR",
      description: "Adaptadores del servidor leen y escriben recursos FHIR R4 en Medplum, consultan elegibilidad de prueba en Stedi y buscan recursos de ayuda con sus divulgaciones intactas.",
    },
    "layer:synthetic-evidence": {
      name: "Evidencia sintética y de evaluación",
      description: "Fixtures FHIR, entradas Stedi protegidas, catálogos bilingües, conceptos adjudicados y casos sintéticos forman la evidencia segura de la demostración.",
    },
    "layer:verification": {
      name: "Verificación y evaluación conversacional",
      description: "Rúbricas ejecutables y pruebas unitarias, de integración y de navegador demuestran la aritmética, la seguridad, el comportamiento bilingüe y la persistencia confirmada.",
    },
    "layer:documentation": {
      name: "Documentación de producto, seguridad y entrega",
      description: "La especificación, las políticas del repositorio, el plan de confiabilidad y el runbook preservan el alcance sintético y la separación entre evidencia histórica y actual.",
    },
    "layer:tooling": {
      name: "Herramientas de compilación, prueba y siembra",
      description: "TypeScript estricto, Next.js, Tailwind, Vitest, Playwright, el grafo de conocimiento y la siembra idempotente de Medplum hacen reproducible la demostración.",
    },
  };

  var tourTranslations = [
    ["BeneBot en un vistazo", "Comience con el README operativo para entender que BeneBot guía una sola factura sintética de Jane Doe. Presenta el recorrido en español, la separación entre evidencia histórica y actual y los modos degradados honestos."],
    ["Entrar a la demostración", "El layout y la página principal presentan un correo de facturación claramente sintético y llevan a Jane Doe a una factura fija antes de cualquier trabajo del servidor."],
    ["Leer la factura", "La página de factura y sus componentes muestran primero el reclamo histórico conciliado y crean una sesión segura antes de revelar el asistente."],
    ["Límite monetario determinista", "Los tipos, el normalizador EOB y las funciones de conciliación producen una estructura única y suprimen cifras cuando la fuente no cuadra."],
    ["Envoltura de confianza firmada", "Cada JWT de corta duración queda ligado a una paciente, factura, EOB, cobertura, encuentro, proveedor y pagador."],
    ["Política bilingüe de conceptos", "Las definiciones en inglés y español vienen de un diccionario del código con analogías seguras, límites y afirmaciones prohibidas."],
    ["Voz con paridad de texto", "El panel conecta Deepgram con exactamente cinco herramientas y conserva el mismo recorrido seguro cuando la voz no está disponible."],
    ["Explicar la adjudicación histórica", "La herramienta de contexto de factura carga solo el EOB y la Invoice de la sesión y rechaza números no conciliados."],
    ["Consultar beneficios actuales", "La elegibilidad actual toma una ruta separada por Stedi, con identidad fija, fecha propia y valores ambiguos conservados como desconocidos."],
    ["Persistir seguimiento confirmado", "Medplum es la fuente del contexto FHIR y el destino de Task y Communication solo después de una confirmación real."],
    ["Demostrar el flujo", "La página del personal reúne EOB, Invoice, elegibilidad, Task y Communication en una cronología accesible."],
    ["Mundo sintético seguro", "El Bundle FHIR fijo y la siembra idempotente reproducen a Jane Doe sin PHI real; los recursos de ayuda mantienen sus divulgaciones."],
    ["Paquete de evidencia de evaluación", "Conceptos, rúbricas, casos bilingües y un contrato de evaluación prueban los límites de la conversación sin convertir material rechazado en política."],
    ["Verificar cada límite", "Pruebas enfocadas demuestran la conciliación, las indicaciones bilingües, las sesiones resistentes a alteración, Stedi conservador y las escrituras Medplum con alcance."],
    ["Ensayar toda la historia", "La prueba de navegador recorre el camino completo en español, desde el correo sintético hasta el seguimiento confirmado y los artefactos FHIR visibles."],
  ];

  var typeLabels = {
    file: { en: "code or asset", es: "código o recurso" },
    config: { en: "configuration", es: "configuración" },
    document: { en: "documentation", es: "documentación" },
    service: { en: "service", es: "servicio" },
    pipeline: { en: "pipeline", es: "pipeline" },
    table: { en: "table", es: "tabla" },
    schema: { en: "schema", es: "esquema" },
    resource: { en: "resource", es: "recurso" },
    endpoint: { en: "endpoint", es: "endpoint" },
  };

  function localized(en, es) {
    return state.language === "es" ? es : en;
  }

  function applyPageLanguage(language) {
    state.language = language;
    document.documentElement.lang = language;

    document.querySelectorAll("[data-en][data-es]").forEach(function (element) {
      element.textContent = element.getAttribute("data-" + language);
    });

    document.querySelectorAll(".language-switch button").forEach(function (button) {
      var isActive = button.getAttribute("data-language") === language;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    updateMathLab();
    renderDictionary();
    renderArchitecture();
    renderTour();
  }

  function updateMathLab() {
    var value = document.getElementById("responsibility-value");
    var status = document.getElementById("reconcile-status");
    var check = document.querySelector(".responsibility-equation .equation-check");
    var toggle = document.getElementById("mismatch-toggle");
    if (!value || !status || !check || !toggle) return;

    document.body.classList.toggle("math-broken", state.mathBroken);
    toggle.setAttribute("aria-pressed", String(state.mathBroken));
    value.textContent = state.mathBroken ? "621" : "620";
    check.textContent = state.mathBroken ? "×" : "✓";

    var icon = status.querySelector(".status-icon");
    var title = status.querySelector("strong");
    var copy = status.querySelector("p");
    icon.textContent = state.mathBroken ? "!" : "✓";
    title.textContent = state.mathBroken
      ? localized("Reconciliation failed", "La conciliación falló")
      : localized("Reconciled to $0.01", "Conciliado a $0.01");
    copy.textContent = state.mathBroken
      ? localized(
          "BeneBot gives no numerical explanation and offers human billing review.",
          "BeneBot no da una explicación numérica y ofrece revisión humana de facturación.",
        )
      : localized(
          "Numerical explanation is permitted.",
          "Se permite la explicación numérica.",
        );
  }

  function conceptName(concept, language) {
    var entry = concept[language];
    return entry && entry.term ? entry.term : concept.conceptId;
  }

  function renderDictionary() {
    var list = document.getElementById("concept-list");
    var detail = document.getElementById("concept-detail");
    if (!list || !detail || !state.concepts.length) return;

    list.innerHTML = "";
    state.concepts.forEach(function (concept, index) {
      var button = document.createElement("button");
      var number = document.createElement("span");
      var labels = document.createElement("span");
      var primary = document.createElement("strong");
      var secondary = document.createElement("small");
      var active = index === state.selectedConcept;

      button.type = "button";
      button.className = "concept-button" + (active ? " active" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(active));
      number.textContent = String(index + 1).padStart(2, "0");
      primary.textContent = conceptName(concept, state.language);
      secondary.textContent = conceptName(concept, state.language === "en" ? "es" : "en");
      labels.appendChild(primary);
      labels.appendChild(secondary);
      button.appendChild(number);
      button.appendChild(labels);
      button.addEventListener("click", function () {
        state.selectedConcept = index;
        renderDictionary();
      });
      list.appendChild(button);
    });

    var concept = state.concepts[state.selectedConcept];
    var entry = concept[state.language];
    var otherEntry = concept[state.language === "en" ? "es" : "en"];
    detail.innerHTML = "";

    var label = document.createElement("div");
    label.className = "concept-label";
    var labelText = document.createElement("p");
    labelText.textContent = localized("Approved runtime guidance", "Guía aprobada para ejecución");
    var pair = document.createElement("span");
    pair.textContent = entry.term + " ↔ " + otherEntry.term;
    label.appendChild(labelText);
    label.appendChild(pair);

    var title = document.createElement("h3");
    title.textContent = entry.term;
    var definition = document.createElement("p");
    definition.className = "concept-definition";
    definition.textContent = entry.definition;

    var columns = document.createElement("div");
    columns.className = "concept-columns";
    columns.appendChild(makeConceptSection(
      localized("Safe analogy", "Analogía segura"),
      entry.analogy,
    ));
    columns.appendChild(makeConceptSection(
      localized("Analogy boundary", "Límite de la analogía"),
      entry.boundary,
    ));
    columns.appendChild(makeConceptListSection(
      localized("Never say", "Nunca decir"),
      entry.neverSay || [],
    ));
    columns.appendChild(makeConceptListSection(
      localized("Recognized alternatives", "Alternativas reconocidas"),
      entry.alternatives && entry.alternatives.length
        ? entry.alternatives
        : [otherEntry.term],
    ));

    var check = document.createElement("div");
    check.className = "concept-check";
    var checkTitle = document.createElement("strong");
    checkTitle.textContent = localized("The runtime boundary", "El límite de ejecución");
    var checkCopy = document.createElement("p");
    checkCopy.textContent = localized(
      "General definitions may be explained. Patient-specific amounts require a successful, session-scoped tool result.",
      "Las definiciones generales pueden explicarse. Los montos de la paciente requieren un resultado exitoso y limitado a la sesión.",
    );
    check.appendChild(checkTitle);
    check.appendChild(checkCopy);

    detail.appendChild(label);
    detail.appendChild(title);
    detail.appendChild(definition);
    detail.appendChild(columns);
    detail.appendChild(check);
  }

  function makeConceptSection(title, copy) {
    var section = document.createElement("section");
    var heading = document.createElement("h4");
    var paragraph = document.createElement("p");
    heading.textContent = title;
    paragraph.textContent = copy;
    section.appendChild(heading);
    section.appendChild(paragraph);
    return section;
  }

  function makeConceptListSection(title, items) {
    var section = document.createElement("section");
    var heading = document.createElement("h4");
    var list = document.createElement("ul");
    heading.textContent = title;
    items.forEach(function (item) {
      var row = document.createElement("li");
      row.textContent = item;
      list.appendChild(row);
    });
    section.appendChild(heading);
    section.appendChild(list);
    return section;
  }

  function layerCopy(layer) {
    if (state.language === "es" && layerTranslations[layer.id]) {
      return layerTranslations[layer.id];
    }
    return { name: layer.name, description: layer.description };
  }

  function renderArchitecture() {
    var tabs = document.getElementById("layer-tabs");
    var detail = document.getElementById("layer-detail");
    if (!tabs || !detail || !state.graph) return;

    tabs.innerHTML = "";
    state.graph.layers.forEach(function (layer, index) {
      var copy = layerCopy(layer);
      var button = document.createElement("button");
      var number = document.createElement("span");
      var name = document.createElement("strong");
      var count = document.createElement("small");
      var active = index === state.selectedLayer;

      button.type = "button";
      button.className = "layer-tab" + (active ? " active" : "");
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(active));
      number.textContent = String(index + 1).padStart(2, "0");
      name.textContent = copy.name;
      count.textContent = String(layer.nodeIds.length);
      button.appendChild(number);
      button.appendChild(name);
      button.appendChild(count);
      button.addEventListener("click", function () {
        state.selectedLayer = index;
        renderArchitecture();
      });
      tabs.appendChild(button);
    });

    var selected = state.graph.layers[state.selectedLayer];
    var selectedCopy = layerCopy(selected);
    var nodesById = new Map(
      state.graph.nodes.map(function (node) {
        return [node.id, node];
      }),
    );
    var representative = selected.nodeIds
      .map(function (id) { return nodesById.get(id); })
      .filter(Boolean)
      .slice(0, 7);

    detail.innerHTML = "";
    var meta = document.createElement("div");
    meta.className = "layer-detail-meta";
    var position = document.createElement("span");
    var files = document.createElement("span");
    position.textContent = localized("Layer ", "Capa ") + String(state.selectedLayer + 1) + " / " + String(state.graph.layers.length);
    files.textContent = String(selected.nodeIds.length) + " " + localized("files", "archivos");
    meta.appendChild(position);
    meta.appendChild(files);

    var title = document.createElement("h3");
    title.textContent = selectedCopy.name;
    var description = document.createElement("p");
    description.className = "layer-description";
    description.textContent = selectedCopy.description;

    var samples = document.createElement("div");
    samples.className = "node-samples";
    representative.forEach(function (node) {
      var row = document.createElement("div");
      var path = document.createElement("code");
      var type = document.createElement("span");
      row.className = "node-sample";
      path.textContent = node.filePath || node.id;
      type.textContent = typeLabels[node.type]
        ? typeLabels[node.type][state.language]
        : node.type;
      row.appendChild(path);
      row.appendChild(type);
      samples.appendChild(row);
    });

    detail.appendChild(meta);
    detail.appendChild(title);
    detail.appendChild(description);
    detail.appendChild(samples);
  }

  function renderTour() {
    var list = document.getElementById("tour-list");
    if (!list || !state.graph) return;
    list.innerHTML = "";
    state.graph.tour.forEach(function (step, index) {
      var translated = tourTranslations[index];
      var item = document.createElement("li");
      var number = document.createElement("span");
      var copy = document.createElement("div");
      var title = document.createElement("strong");
      var description = document.createElement("p");
      number.textContent = String(step.order).padStart(2, "0");
      title.textContent = state.language === "es" && translated ? translated[0] : step.title;
      description.textContent = state.language === "es" && translated ? translated[1] : step.description;
      copy.appendChild(title);
      copy.appendChild(description);
      item.appendChild(number);
      item.appendChild(copy);
      list.appendChild(item);
    });
  }

  function showDataError(elementId, artifactName) {
    var element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = "";
    var message = document.createElement("p");
    var link = document.createElement("a");
    message.textContent = localized(
      "The interactive view could not load. Open the raw artifact instead: ",
      "La vista interactiva no pudo cargar. Abra el artefacto directamente: ",
    );
    link.href = "artifacts/" + artifactName;
    link.textContent = artifactName;
    message.appendChild(link);
    element.appendChild(message);
  }

  function loadArtifacts() {
    fetch("artifacts/approved-runtime-guidance.json")
      .then(function (response) {
        if (!response.ok) throw new Error("concept artifact failed");
        return response.json();
      })
      .then(function (concepts) {
        state.concepts = concepts;
        renderDictionary();
      })
      .catch(function () {
        showDataError("concept-detail", "approved-runtime-guidance.json");
      });

    fetch("artifacts/knowledge-graph.json")
      .then(function (response) {
        if (!response.ok) throw new Error("graph artifact failed");
        return response.json();
      })
      .then(function (graph) {
        state.graph = graph;
        renderArchitecture();
        renderTour();
      })
      .catch(function () {
        showDataError("layer-detail", "knowledge-graph.json");
      });
  }

  function setupReveal() {
    var elements = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    elements.forEach(function (element) { observer.observe(element); });
  }

  document.querySelectorAll(".language-switch button").forEach(function (button) {
    button.addEventListener("click", function () {
      applyPageLanguage(button.getAttribute("data-language"));
    });
  });

  var mismatchToggle = document.getElementById("mismatch-toggle");
  if (mismatchToggle) {
    mismatchToggle.addEventListener("click", function () {
      state.mathBroken = !state.mathBroken;
      updateMathLab();
    });
  }

  applyPageLanguage("en");
  setupReveal();
  loadArtifacts();
})();

// Test helper: loads mp-creator.js into a jsdom environment and exposes the MPCreator
// class for use in Node's built-in test runner. mp-creator.js is a plain (non-module)
// browser script that expects global `document`, `DOMParser`, `XMLSerializer`, and
// `XMLHttpRequest` - this helper provides jsdom-backed implementations, plus a
// synchronous XMLHttpRequest stub that reads fragment template files directly from
// disk (mirroring the real synchronous XHR-against-a-static-file behavior used by
// processFragmentTemplate() when a fragment's `template` is a `.mpx` filename).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const REPO_ROOT = path.join(__dirname, '..', '..');

function createSyncXMLHttpRequest() {
    return class SyncXMLHttpRequest {
        open(method, url) {
            this._url = url;
        }
        send() {
            const cleanUrl = String(this._url).split('?')[0];
            const filePath = path.join(REPO_ROOT, decodeURIComponent(cleanUrl));
            try {
                this.responseText = fs.readFileSync(filePath, 'utf8');
                this.status = 200;
            } catch (err) {
                this.responseText = '';
                this.status = 404;
            }
        }
    };
}

/**
 * Creates a fresh, isolated MPCreator instance backed by a new jsdom document.
 * Each call gets its own document/window so tests don't leak DOM state between
 * each other (important since MPCreator attaches document-level event listeners).
 */
function createMpCreator() {
    const dom = new JSDOM('<!doctype html><html><body><div id="component-configs"></div></body></html>', {
        url: 'http://localhost/creator.html',
        runScripts: 'outside-only'
    });

    const context = dom.window;
    context.XMLHttpRequest = createSyncXMLHttpRequest();

    const code = fs.readFileSync(path.join(REPO_ROOT, 'mp-creator.js'), 'utf8');
    // Expose the class outside the script's top-level lexical scope so this helper
    // can instantiate it (top-level `class` declarations are not added as globalThis
    // properties, unlike `var`/function declarations).
    const exportedCode = `${code}\n;window.__MPCreator = MPCreator;\n`;

    vm.runInContext(exportedCode, dom.getInternalVMContext(), { filename: 'mp-creator.js' });

    const MPCreatorClass = context.__MPCreator;
    if (!MPCreatorClass) {
        throw new Error('Failed to load MPCreator class from mp-creator.js');
    }

    const instance = new MPCreatorClass();
    return { instance, document: context.document, window: context };
}

/**
 * Renders a discovery component's config fields into the jsdom document, then saves
 * them back into mpData.configurations - exactly mirroring what happens in the real
 * browser wizard when a discovery card's default field values are rendered and the
 * user proceeds without editing anything. This is how we validate that "ready to use
 * out of the box" starter templates (e.g. NFS Mount Discovery) actually produce a
 * complete, valid MP with zero required user edits.
 */
function selectDiscoveryWithDefaults(mp, discoveryType, overrides = {}) {
    const { instance, document } = mp;
    instance.mpData.selectedComponents.discovery = discoveryType;

    const fragment = instance.fragmentLibrary[discoveryType];
    if (!fragment) {
        throw new Error(`Unknown discovery type: ${discoveryType}`);
    }

    const container = document.getElementById('component-configs');
    container.innerHTML = `<div id="config-${discoveryType}">${instance.generateConfigFields(discoveryType, fragment.fields)}</div>`;

    // Apply overrides directly to the rendered DOM inputs (simulating real user edits)
    // rather than mutating mpData.configurations directly. This matters because
    // processFragmentTemplate() calls saveConfigurationData() again internally before
    // generating XML, which re-reads current DOM input values and would otherwise wipe
    // out an override that was only applied to the in-memory config object.
    for (const [fieldId, value] of Object.entries(overrides)) {
        const el = document.getElementById(`${discoveryType}-${fieldId}`);
        if (el) {
            el.value = value;
        }
    }

    instance.saveConfigurationData();
}

module.exports = { createMpCreator, selectDiscoveryWithDefaults, REPO_ROOT };

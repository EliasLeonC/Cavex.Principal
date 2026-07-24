/**
 * vista-ingreso-taller.js
 * Lógica para la pantalla "Registro de Ingreso a Taller".
 */

'use strict';

/* ─── Estado global ─────────────────────────────────────────────────────── */
let _vehiculos = [];         // Catálogo completo de vehículos
let _asignaciones = [];      // Asignaciones activas cargadas una vez
let _empleados = [];         // Catálogo completo de empleados
let _modoCompleto = false;   // true = switch ON (reporte de taller habilitado)
let _listaHistorial = [];    // Datos completos de la tabla de historial
let _filtroEstadoHistorial = 'todos'; // todos | incompletos | completos
let _busquedaHistorial = ''; // Término de búsqueda en tabla
let _isSubmitting = false;   // Evita envíos duplicados del formulario

/* ─── Init ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    setFechaHoy();
    cargarCatalogos();
    cargarHistorial();
    bindSwitch();
    bindCostosChange();
    bindComprobanteUpload();
    bindFormSubmit();
    bindFormValidation();
    bindResetButton();
    bindDescriptionCounter();

    setupStatusTabs('statusTabs', (filterValue) => {
        _filtroEstadoHistorial = filterValue;
        renderTablaHistorial();
    });

    document.getElementById('tableSearch')?.addEventListener('input', (e) => {
        _busquedaHistorial = e.target.value.trim().toLowerCase();
        renderTablaHistorial();
    });

    const moInput = document.getElementById('mant-mnyCostoManoObra');
    if (moInput) {
        moInput.addEventListener('input', () => formatCurrencyInput(moInput));
    }
    const refInput = document.getElementById('mant-mnyCostoRefacciones');
    if (refInput) {
        refInput.addEventListener('input', () => formatCurrencyInput(refInput));
    }
    const kmInput = document.getElementById('mant-decKilometrajeActual');
    if (kmInput) {
        kmInput.addEventListener('input', () => {
            formatKilometraje(kmInput);
        });
    }
});

/* ─── Fecha por defecto = hoy ────────────────────────────────────────────── */
function setFechaHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('mant-dteFechaServicio');
    if (!fechaInput) return;
    fechaInput.max = hoy;
    fechaInput.value = hoy;
}

/* ─── Validación visual compatible con Bootstrap 5 ─────────────────────── */
function bindFormValidation() {
    const form = document.getElementById('formIngresoTaller');
    if (!form) return;

    form.querySelectorAll('input, select, textarea').forEach(field => {
        if (field.type === 'file' || field.type === 'hidden' || field.type === 'checkbox') return;
        ['input', 'change', 'blur'].forEach(eventName => {
            field.addEventListener(eventName, () => validateField(field));
        });
    });
}

function validateField(field) {
    if (!field || field.disabled) {
        clearFieldValidation(field);
        return true;
    }

    let valid = field.checkValidity();
    if (field.id === 'mant-decKilometrajeActual') {
        const value = getKilometrajeNumerico(field.value);
        valid = Number.isFinite(value) && value >= 0 && field.value.trim() !== '';
    }

    field.classList.toggle('is-invalid', !valid);
    field.classList.toggle('is-valid', valid && hasFieldValue(field));
    field.setAttribute('aria-invalid', String(!valid));
    return valid;
}

function hasFieldValue(field) {
    return field.type === 'checkbox' ? field.checked : field.value.trim() !== '';
}

function clearFieldValidation(field) {
    if (!field) return;
    field.classList.remove('is-valid', 'is-invalid');
    field.removeAttribute('aria-invalid');
}

function validateForm(form) {
    let valid = true;
    form.querySelectorAll('input, select, textarea').forEach(field => {
        if (field.type === 'file' || field.type === 'hidden' || field.type === 'checkbox') return;
        if (!validateField(field)) valid = false;
    });
    return valid && form.checkValidity();
}

function bindResetButton() {
    document.getElementById('btnLimpiarIngresoTaller')?.addEventListener('click', resetForm);
}

function bindDescriptionCounter() {
    const description = document.getElementById('mant-strDescripcion');
    if (!description) return;
    description.addEventListener('input', updateDescriptionCounter);
    updateDescriptionCounter();
}

function updateDescriptionCounter() {
    const description = document.getElementById('mant-strDescripcion');
    const counter = document.getElementById('mantDescripcionCounter');
    if (!description || !counter) return;
    const max = Number(description.maxLength) || 500;
    const length = description.value.length;
    counter.textContent = `${length}/${max}`;
    counter.classList.toggle('is-near-limit', length >= Math.floor(max * .9));
}

function formatKilometraje(input) {
    const rawValue = input.value.replace(/[^0-9]/g, '');
    input.value = rawValue ? Number(rawValue).toLocaleString('es-MX') : '';
}

function getKilometrajeNumerico(value) {
    const normalized = String(value ?? '').replace(/,/g, '');
    return normalized === '' ? NaN : Number(normalized);
}

/* ─── Switch toggle ─────────────────────────────────────────────────────── */
function bindSwitch() {
    const switchEl = document.getElementById('switchServicioConcluido');
    if (!switchEl) return;
    switchEl.addEventListener('change', () => {
        _modoCompleto = switchEl.checked;
        switchEl.setAttribute('aria-checked', _modoCompleto.toString());
        toggleCard2(_modoCompleto);
    });
}

// Función para mostrar u ocultar la sección "Reporte de Taller" según el estado del switch
function toggleCard2(habilitar) {
    // Obtenemos el contenedor de la sección 2 (Reporte de Taller)
    const card2     = document.getElementById('card2');
    // Obtenemos la etiqueta de texto del switch (NO / SÍ)
    const label     = document.getElementById('switchLabel');
    // Obtenemos el texto del botón de guardado
    const btnLabel  = document.getElementById('btnGuardarLabel');
    // Obtenemos todos los elementos interactivos dentro de la sección 2
    const inputs2   = card2?.querySelectorAll('input:not([type=hidden]), select, textarea');

    // Si el switch está activado en SÍ
    if (habilitar) {
        // Mostramos la sección 2 en la pantalla
        if (card2) card2.style.display = 'block';
        // Cambiamos el texto del switch a "SÍ"
        if (label) label.textContent = 'SÍ';
        // Actualizamos el texto del botón principal
        if (btnLabel) btnLabel.textContent = 'Guardar reporte de taller';
        // Habilitamos los campos internos para captura
        inputs2?.forEach(el => {
            el.disabled = false;
        });
        // Habilitamos la zona de carga de comprobante
        document.getElementById('mantComprobanteArea')?.classList.remove('mant-upload-area--disabled');
    } else {
        // Si el switch está en NO, ocultamos la sección 2 por completo
        if (card2) card2.style.display = 'none';
        // Cambiamos el texto del switch a "NO"
        if (label) label.textContent = 'NO';
        // Restauramos el texto del botón principal
        if (btnLabel) btnLabel.textContent = 'Registrar mantenimiento';
        // Deshabilitamos los campos de la sección 2
        inputs2?.forEach(el => el.disabled = true);
        // Deshabilitamos la zona de carga de comprobante
        document.getElementById('mantComprobanteArea')?.classList.add('mant-upload-area--disabled');
    }
}

/* ─── Cargar catálogos ───────────────────────────────────────────────────── */
async function cargarCatalogos() {
    try {
        const [resVehiculos, resCatalogos, resResponsables, resAsignaciones, resEmpleados] = await Promise.all([
            fetch('/Vehiculos/GetVehiculos').then(r => r.json()),
            fetch('/IngresoTaller/GetIngresoTallerCatalogos').then(r => r.json()),
            fetch('/IngresoTaller/ResponsablesServicio/GetResponsables').then(r => r.json()),
            fetch('/Asignaciones/GetAsignacionesActivas').then(r => r.json()),
            fetch('/Empleado/GetEmpleadosDropdown').then(r => r.json()).catch(() => ({ success: false }))
        ]);

        // Asignaciones activas
        if (resAsignaciones.success) {
            _asignaciones = resAsignaciones.data || [];
        }

        const vehIdAsignados = new Set(
            (_asignaciones || [])
                .filter(a => (a.decKilometrajeFinal == null && a.DecKilometrajeFinal == null) || Number(a.decKilometrajeFinal ?? a.DecKilometrajeFinal) === 0)
                .map(a => Number(a.idVehDatosGenerales ?? a.IdVehDatosGenerales))
                .filter(id => !isNaN(id) && id > 0)
        );

        const empIdAsignados = new Set(
            (_asignaciones || [])
                .filter(a => (a.decKilometrajeFinal == null && a.DecKilometrajeFinal == null) || Number(a.decKilometrajeFinal ?? a.DecKilometrajeFinal) === 0)
                .map(a => Number(a.idEmpEmpleado ?? a.IdEmpEmpleado))
                .filter(id => !isNaN(id) && id > 0)
        );

        // Vehículos solo asignados
        if (resVehiculos.success) {
            _vehiculos = (resVehiculos.data || []).filter(v => vehIdAsignados.has(Number(v.id ?? v.Id)));
            poblarSelect('mant-idVehDatosGenerales', _vehiculos, v => ({
                value: v.id ?? v.Id,
                text: `${v.strPlaca || v.StrPlaca || '—'} · ${v.strMarca || v.StrMarca || ''} ${v.strModelo || v.StrModelo || ''} ${v.intAnio || v.IntAnio || ''}`.trim()
            }));
        }

        // Empleados (Choferes) solo asignados
        if (resEmpleados.success && resEmpleados.data) {
            _empleados = (resEmpleados.data || []).filter(e => empIdAsignados.has(Number(e.id ?? e.Id)));
            poblarSelect('mant-idEmpEmpleadoChofer', _empleados, e => ({
                value: e.id ?? e.Id,
                text: `${e.strNombre || e.StrNombre || ''} ${e.strApellidoPaterno || e.StrApellidoPaterno || ''} ${e.strApellidoMaterno || e.StrApellidoMaterno || ''}`.trim()
            }));
        }

        // Catálogos de Ingreso a Taller (Tipos de Servicio, Talleres y Formas de Pago)
        if (resCatalogos.success && resCatalogos.data) {
            if (resCatalogos.data.tiposServicio) {
                poblarSelect('mant-idVehCatTipoServicio', resCatalogos.data.tiposServicio, item => ({
                    value: item.id ?? item.Id,
                    text: item.strValor || item.StrValor || ''
                }));
            }
            if (resCatalogos.data.talleres) {
                poblarSelect('mant-idVehCatTaller', resCatalogos.data.talleres, item => ({
                    value: item.id ?? item.Id,
                    text: item.strValor || item.StrValor || ''
                }));
            }
            if (resCatalogos.data.formasPago) {
                poblarSelect('mant-idVehFormaPago', resCatalogos.data.formasPago, item => ({
                    value: item.id ?? item.Id,
                    text: item.strValor || item.StrValor || ''
                }));
            }
        }

        // Encargado Autorizador / Responsables de Servicio
        if (resResponsables && resResponsables.data) {
            const listResp = Array.isArray(resResponsables.data) ? resResponsables.data : (resResponsables.data.items || []);
            poblarSelect('mant-idVehCatResponsableServicio', listResp, item => ({
                value: item.id ?? item.Id,
                text: item.strValor || item.StrValor || ''
            }));
        }

        // Los dropdowns son convertidos automáticamente por el componente global custom-select de CAVEX (site.js)
        bindVinculacionVehiculoEmpleado();

    } catch (err) {
        console.error('Error cargando catálogos:', err);
    }
}

/* ─── Selector de vehículo / chofer / kilometraje (Vinculación automática) ─── */
// Bandera para evitar bucles infinitos durante eventos simulados de cambio
let isVinculandoIngresoTaller = false;

// Función para inicializar la vinculación automática de campos
function bindVinculacionVehiculoEmpleado() {
    // Referencia al select de vehículo
    const selectVeh = document.getElementById('mant-idVehDatosGenerales');
    // Referencia al select de chofer (empleado)
    const selectEmp = document.getElementById('mant-idEmpEmpleadoChofer');

    // Evento al cambiar el vehículo seleccionado
    selectVeh?.addEventListener('change', () => {
        // Si la vinculación está en proceso, prevenimos reentradas
        if (isVinculandoIngresoTaller) return;
        // Activamos la bandera de bloqueo temporal
        isVinculandoIngresoTaller = true;
        try {
            // Obtenemos el ID numérico del vehículo elegido
            const vehId = parseInt(selectVeh.value, 10);
            // Referencia al campo donde se ingresa el kilometraje actual
            const kmInput = document.getElementById('mant-decKilometrajeActual');
            
            // Si se seleccionó un vehículo válido
            if (vehId) {
                // Buscamos el objeto del vehículo dentro de la lista cargada
                const veh = _vehiculos.find(v => Number(v.id) === vehId);
                // Si se encuentra el vehículo y existe el input de kilometraje
                if (veh && kmInput) {
                    // Extraemos su kilometraje registrado actual
                    const kmVal = veh.decKilometrajeActual ?? veh.DecKilometrajeActual ?? 0;
                    // Escribimos el valor formateado con comas en el campo de texto
                    kmInput.value = Number(kmVal).toLocaleString('es-MX');
                    validateField(kmInput);
                }

                // Buscamos si existe una asignación activa asociada al vehículo
                const asig = _asignaciones.find(a => Number(a.idVehDatosGenerales) === vehId);
                // Si encontramos asignación activa y existe el select de chofer
                if (asig && selectEmp) {
                    // Si el chofer seleccionado no coincide con el chofer asignado
                    if (selectEmp.value !== String(asig.idEmpEmpleado)) {
                        // Seleccionamos al chofer correspondiente automáticamente
                        selectEmp.value = String(asig.idEmpEmpleado);
                        // Notificamos el cambio a posibles escuchadores
                        selectEmp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    // Deshabilitamos el select del chofer para evitar cambios no autorizados
                    selectEmp.disabled = true;
                } else if (selectEmp) {
                    // Si el vehículo no tiene asignación activa, permitimos elegir chofer libremente
                    selectEmp.disabled = false;
                }
            } else {
                // Si se deselecciona el vehículo, vaciamos el kilometraje
                if (kmInput) kmInput.value = '';
                // Si existe el select del chofer, lo reiniciamos
                if (selectEmp) {
                    if (selectEmp.value !== '') {
                        selectEmp.value = '';
                        selectEmp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    // Habilitamos la selección manual
                    selectEmp.disabled = false;
                }
            }
        } finally {
            // Liberamos la bandera para futuros eventos de usuario
            isVinculandoIngresoTaller = false;
        }
    });

    // Evento al cambiar manualmente el chofer seleccionado
    selectEmp?.addEventListener('change', () => {
        // Prevenimos bucles de eventos entre vehículo y chofer
        if (isVinculandoIngresoTaller) return;
        // Activamos la bandera de bloqueo temporal
        isVinculandoIngresoTaller = true;
        try {
            // Obtenemos el ID numérico del empleado elegido
            const empId = parseInt(selectEmp.value, 10);
            // Si se seleccionó un empleado
            if (empId) {
                // Buscamos si dicho empleado tiene un vehículo asignado
                const asig = _asignaciones.find(a => a.idEmpEmpleado === empId);
                // Si encontramos la asignación activa y existe el select de vehículo
                if (asig && selectVeh) {
                    // Si el vehículo no está seleccionado
                    if (selectVeh.value !== String(asig.idVehDatosGenerales)) {
                        // Seleccionamos automáticamente el vehículo del chofer
                        selectVeh.value = String(asig.idVehDatosGenerales);
                        // Disparamos el evento para que cargue también su kilometraje
                        selectVeh.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        } finally {
            // Liberamos la bandera al finalizar la operación
            isVinculandoIngresoTaller = false;
        }
    });
}

/* ─── Cálculo en vivo: Total = Mano de Obra + Refacciones ───────────────── */
function bindCostosChange() {
    ['mant-mnyCostoManoObra', 'mant-mnyCostoRefacciones'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcularTotal);
    });
}

function calcularTotal() {
    const moStr = document.getElementById('mant-mnyCostoManoObra')?.value || '';
    const refStr = document.getElementById('mant-mnyCostoRefacciones')?.value || '';
    const mo  = parseFloat(moStr.replace(/,/g, '')) || 0;
    const ref = parseFloat(refStr.replace(/,/g, '')) || 0;
    const total = mo + ref;
    const totalEl = document.getElementById('mant-mnyCostoTotal');
    if (totalEl) {
        totalEl.value = (mo > 0 || ref > 0) ? total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    }
}

/* ─── Upload comprobante ─────────────────────────────────────────────────── */
function bindComprobanteUpload() {
    const area    = document.getElementById('mantComprobanteArea');
    const input   = document.getElementById('mantComprobanteArchivo');
    const preview = document.getElementById('mantFilePreview');
    const prompt  = document.getElementById('mantComprobantePrompt');
    const btnQuit = document.getElementById('btnQuitarComprobanteMant');

    if (!area || !input) return;

    input.addEventListener('click', e => {
        e.stopPropagation();
    });
    area.addEventListener('click', () => { if (!input.disabled) input.click(); });

    area.addEventListener('dragenter', e => {
        e.preventDefault();
        e.stopPropagation();
        if (!input.disabled) area.classList.add('dragover');
    });
    area.addEventListener('dragover', e => { e.preventDefault(); if (!input.disabled) area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (!input.disabled && e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        }
    });

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({ icon: 'warning', title: 'Archivo muy grande', text: 'El comprobante no debe superar 5 MB.', confirmButtonColor: '#0d233a' });
            input.value = '';
            return;
        }
        document.getElementById('mantFileName').textContent = file.name;
        document.getElementById('mantFileSize').textContent = formatBytes(file.size);
        if (prompt) prompt.style.display = 'none';
        if (preview) preview.style.display = 'flex';
    });

    btnQuit?.addEventListener('click', () => {
        input.value = '';
        const hiddenUrl = document.getElementById('mant-strUrlComprobantePago');
        if (hiddenUrl) hiddenUrl.value = '';
        if (preview) preview.style.display = 'none';
        if (prompt) prompt.style.display  = '';
    });
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Submit del formulario ──────────────────────────────────────────────── */
function bindFormSubmit() {
    document.getElementById('formIngresoTaller')?.addEventListener('submit', async e => {
        e.preventDefault();
        e.stopPropagation();

        if (_isSubmitting) return;

        const form = e.target;
        if (!validateForm(form)) {
            if (_modoCompleto) {
                const fp = document.getElementById('mant-idVehFormaPago');
                if (fp && !fp.value) { fp.classList.add('is-invalid'); return; }
            }
            form.classList.add('was-validated');
            return;
        }
        form.classList.add('was-validated');

        await guardarIngresoTaller();
    });
}

async function guardarIngresoTaller() {
    const btn = document.getElementById('btnGuardarIngresoTaller');
    if (!btn || _isSubmitting) return;
    _isSubmitting = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Guardando...</span>';

    try {
        const formData = new FormData();
        formData.append('idVehDatosGenerales',          document.getElementById('mant-idVehDatosGenerales').value);
        formData.append('idEmpEmpleadoChofer',          document.getElementById('mant-idEmpEmpleadoChofer').value);
        formData.append('idVehCatTipoServicio',         document.getElementById('mant-idVehCatTipoServicio').value);
        formData.append('dteFechaServicio',             document.getElementById('mant-dteFechaServicio').value);
        formData.append('decKilometrajeActual',         document.getElementById('mant-decKilometrajeActual').value.replace(/,/g, ''));
        formData.append('idVehCatTaller',               document.getElementById('mant-idVehCatTaller').value);
        formData.append('strDescripcion',               document.getElementById('mant-strDescripcion').value);
        formData.append('idVehCatResponsableServicio',  document.getElementById('mant-idVehCatResponsableServicio').value);

        if (_modoCompleto) {
            formData.append('mnyCostoManoObra',    (document.getElementById('mant-mnyCostoManoObra').value || '0').replace(/,/g, ''));
            formData.append('mnyCostoRefacciones', (document.getElementById('mant-mnyCostoRefacciones').value || '0').replace(/,/g, ''));
            formData.append('idVehFormaPago',      document.getElementById('mant-idVehFormaPago').value || '1');

            const archivo = document.getElementById('mantComprobanteArchivo').files[0];
            if (archivo) formData.append('ComprobanteArchivo', archivo);
        } else {
            formData.append('mnyCostoManoObra',    '0');
            formData.append('mnyCostoRefacciones', '0');
            formData.append('idVehFormaPago',      '1');
        }

        const res  = await fetch('/IngresoTaller/SaveIngresoTaller', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Registro guardado!',
                text: data.message || 'El ingreso a taller se registró correctamente.',
                confirmButtonColor: '#0d233a'
            });
            resetForm();
            cargarHistorial();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'No se pudo guardar el registro.', confirmButtonColor: '#0d233a' });
        }

    } catch (err) {
        console.error('SaveIngresoTaller error:', err);
        Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo contactar con el servidor. Intenta de nuevo.', confirmButtonColor: '#0d233a' });
    } finally {
        _isSubmitting = false;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        const textoBtn = _modoCompleto ? 'Guardar reporte de taller' : 'Registrar mantenimiento';
        btn.innerHTML = `<i class="bi bi-check2-circle" aria-hidden="true"></i><span id="btnGuardarLabel">${textoBtn}</span>`;
    }
}

function resetForm() {
    const form = document.getElementById('formIngresoTaller');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
        form.querySelectorAll('.is-valid, .is-invalid').forEach(clearFieldValidation);
    }
    // Reset switch
    const sw = document.getElementById('switchServicioConcluido');
    if (sw) sw.checked = false;
    _modoCompleto = false;
    toggleCard2(false);

    // Reset comprobante
    const preview = document.getElementById('mantFilePreview');
    const prompt = document.getElementById('mantComprobantePrompt');
    const totalInput = document.getElementById('mant-mnyCostoTotal');
    if (preview) preview.style.display = 'none';
    if (prompt) prompt.style.display = '';
    if (totalInput) totalInput.value = '0.00';
    setFechaHoy();
    updateDescriptionCounter();
}

/* ─── Historial de ingresos a taller ───────────────────────────────────────── */
async function cargarHistorial() {
    const tbody = document.getElementById('ingresoTallerTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="mant-table-state"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando registros...</td></tr>';

    try {
        const res  = await fetch('/IngresoTaller/GetIngresoTaller');
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            _listaHistorial = data.data;
        } else {
            _listaHistorial = [];
        }
        renderTablaHistorial();
    } catch (err) {
        console.error("Error al cargar historial:", err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="mant-table-state text-danger"><div class="mant-empty-state"><i class="bi bi-exclamation-triangle"></i><strong>No fue posible cargar el historial</strong><span>Intenta nuevamente en unos momentos.</span></div></td></tr>';
    }
}

function esTicketCompleto(m) {
    const total = m.mnyCostoTotal ?? ((m.mnyCostoManoObra || 0) + (m.mnyCostoRefacciones || 0));
    return Boolean(m.bitServicioConcluido || m.bolConcluido || (total > 0 && m.strUrlComprobantePago));
}

function renderTablaHistorial() {
    const tbody = document.getElementById('ingresoTallerTableBody');
    if (!tbody) return;

    // Actualizar contadores de pestañas
    const totalCount = _listaHistorial.length;
    const incompletosCount = _listaHistorial.filter(m => !esTicketCompleto(m)).length;
    const completosCount = _listaHistorial.filter(m => esTicketCompleto(m)).length;

    const elTodos = document.getElementById('countTodos');
    const elIncompletos = document.getElementById('countIncompletos');
    const elCompletos = document.getElementById('countCompletos');
    const elActivos = document.getElementById('countMantenimientoActivo');
    if (elTodos) elTodos.textContent = totalCount;
    if (elIncompletos) elIncompletos.textContent = incompletosCount;
    if (elCompletos) elCompletos.textContent = completosCount;
    if (elActivos) elActivos.textContent = incompletosCount;

    // Filtrar lista
    let filtrados = _listaHistorial;

    if (_filtroEstadoHistorial === 'incompletos') {
        filtrados = filtrados.filter(m => !esTicketCompleto(m));
    } else if (_filtroEstadoHistorial === 'completos') {
        filtrados = filtrados.filter(m => esTicketCompleto(m));
    }

    if (_busquedaHistorial) {
        filtrados = filtrados.filter(m => {
            const strVeh = `${m.strVehDatosGenerales || ''} ${m.strMarca || ''} ${m.strModelo || ''} ${m.strPlaca || ''}`.toLowerCase();
            const strTaller = (m.strVehCatTaller || m.strTaller || '').toLowerCase();
            const strTipo = (m.strTipoServicio || '').toLowerCase();
            const strEnc = (m.strEmpEmpleado || m.strEncargado || '').toLowerCase();
            return strVeh.includes(_busquedaHistorial) ||
                   strTaller.includes(_busquedaHistorial) ||
                   strTipo.includes(_busquedaHistorial) ||
                   strEnc.includes(_busquedaHistorial);
        });
    }

    if (!filtrados.length) {
        const hasFilters = Boolean(_busquedaHistorial || _filtroEstadoHistorial !== 'todos');
        tbody.innerHTML = `<tr><td colspan="9" class="mant-table-state"><div class="mant-empty-state"><i class="bi ${hasFilters ? 'bi-search' : 'bi-wrench-adjustable'}"></i><strong>${hasFilters ? 'Sin coincidencias' : 'Aún no hay mantenimientos registrados'}</strong><span>${hasFilters ? 'Prueba con otro término o filtro.' : 'Los ingresos registrados aparecerán en este historial.'}</span></div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(m => {
        const total = m.mnyCostoTotal ?? ((m.mnyCostoManoObra || 0) + (m.mnyCostoRefacciones || 0));
        const completo = esTicketCompleto(m);
        const estadoBadge = completo
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Reporte Completo</span>'
            : '<span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">Ticket Incompleto</span>';

        const kmVal = Number(m.decKilometrajeActual ?? m.lngKilometrajeActual ?? 0);
        const fechaVal = formatFechaHora(m.dteFechaServicio || m.dteFechaInicio);
        const vehiculoTexto = m.strVehDatosGenerales || `${m.strMarca || ''} ${m.strModelo || ''}`.trim() || '—';
        const tallerTexto = m.strVehCatTaller || m.strTaller || '—';
        const encargadoTexto = m.strEmpEmpleado || m.strEncargado || '—';

        return `
        <tr>
            <td>
                <div class="fw-bold">${escapeHtml(vehiculoTexto)}</div>
            </td>
            <td>${escapeHtml(tallerTexto)}</td>
            <td>${escapeHtml(m.strTipoServicio || '—')}</td>
            <td>${escapeHtml(encargadoTexto)}</td>
            <td>${fechaVal}</td>
            <td>${kmVal > 0 ? kmVal.toLocaleString('es-MX') + ' km' : '—'}</td>
            <td><div class="fw-bold">$${Number(total || 0).toFixed(2)}</div></td>
            <td>${estadoBadge}</td>
            <td class="text-end">
                <div class="dropdown actions-dropdown d-inline-block">
                    <button class="btn-action-trigger btn-sm" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false">
                        <span>Acciones</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <button class="dropdown-item d-flex align-items-center" type="button" onclick="verDetalleIngresoTaller(${m.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 text-info"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Ver detalles
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item d-flex align-items-center" type="button" onclick="editarIngresoTaller(${m.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 text-primary"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Editar
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item d-flex align-items-center text-danger" type="button" onclick="eliminarIngresoTaller(${m.id})">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="me-2 text-danger"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                Eliminar
                            </button>
                        </li>
                    </ul>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function eliminarIngresoTaller(id) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar registro?',
        text: 'Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#c0392b',
        cancelButtonColor: '#0d233a'
    });
    if (!confirm.isConfirmed) return;

    const res  = await fetch(`/IngresoTaller/DeleteIngresoTaller?id=${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
        cargarHistorial();
    } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.message, confirmButtonColor: '#0d233a' });
    }
}

/* ─── Utilidades ─────────────────────────────────────────────────────────── */
function poblarSelect(selectId, items, mapFn) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    items.forEach(item => {
        const { value, text } = mapFn(item);
        const opt = new Option(text, value);
        sel.add(opt);
    });
    if (current) sel.value = current;
}

function formatFecha(val) {
    if (!val || val === '0001-01-01T00:00:00' || String(val).startsWith('0001-01-01')) return '—';
    const d = new Date(val);
    if (isNaN(d) || d.getFullYear() <= 1900) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFechaHora(val) {
    if (!val || val === '0001-01-01T00:00:00' || String(val).startsWith('0001-01-01')) return '—';
    const date = new Date(val);
    if (isNaN(date) || date.getFullYear() <= 1900) return '—';
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    return date.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {})
    });
}

/**
 * Formatea en tiempo real un input de tipo moneda, permitiendo solo un punto decimal
 * e insertando comas para separar los miles mientras el usuario escribe.
 * @param {HTMLInputElement} input - El elemento input a formatear.
 */
function formatCurrencyInput(input) {
    let value = input.value.replace(/[^0-9.]/g, "");
    const parts = value.split(".");
    if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
    }
    let integerPart = parts[0];
    let decimalPart = parts[1];
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (decimalPart !== undefined) {
        decimalPart = decimalPart.substring(0, 2);
        input.value = integerPart + "." + decimalPart;
    } else {
        input.value = integerPart;
    }
}




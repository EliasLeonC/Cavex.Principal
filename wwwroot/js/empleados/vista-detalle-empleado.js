const empleadoId = document.getElementById('empleadoDetailsContainer').dataset.id;

// Extrae únicamente el nombre del archivo de una ruta URL completa
function getFilenameFromUrl(url) {
    if (!url || url === 'N/D') return 'No disponible';
    try {
        const parts = url.split('/');
        return parts[parts.length - 1];
    } catch (e) {
        return 'Archivo';
    }
}

// Configura los botones de visualización de documentos en la interfaz abriendo el visor modal
function setupVerDocButton(btnId, nameId, url, docTitle) {
    const btn = document.getElementById(btnId);
    const nameEl = document.getElementById(nameId);
    if (url && url !== 'N/D') {
        nameEl.textContent = getFilenameFromUrl(url);
        nameEl.classList.remove('text-muted');
        btn.removeAttribute('disabled');
        btn.onclick = () => {
            document.getElementById('modalDocumentoViewerLabel').textContent = 'Visualizando: ' + docTitle;
            document.getElementById('iframeDocumentoViewer').src = url;
            const modal = new bootstrap.Modal(document.getElementById('modalDocumentoViewer'));
            modal.show();
        };
    } else {
        nameEl.textContent = 'No disponible';
        nameEl.classList.add('text-muted');
        btn.setAttribute('disabled', 'disabled');
    }
}

// Ejecuta las peticiones asíncronas para cargar los datos del empleado y llenar los elementos DOM correspondientes
document.addEventListener('DOMContentLoaded', () => {
    Swal.fire({
        title: 'Cargando detalle...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Promesas paralelas para obtener el empleado y mapear catálogos directamente de base de datos
    Promise.all([
        fetch('/Empleado/GetEmpleado?id=' + empleadoId).then(res => res.json()),
        fetch('/Empleado/GetGeneros').then(res => res.json()),
        fetch('/Empleado/GetEstadosCiviles').then(res => res.json()),
        fetch('/Empleado/GetNacionalidades').then(res => res.json()),
        fetch('/AreaLaboral/GetAreas').then(res => res.json())
    ])
    .then(([empRes, generosRes, estadosRes, nacsRes, areasRes]) => {
        Swal.close();
        if (empRes.success && empRes.data) {
            const emp = empRes.data;

            const rawFullName = emp.strNombre + ' ' + emp.strApellidoPaterno + (emp.strApellidoMaterno ? ' ' + emp.strApellidoMaterno : '');
            const fullName = toTitleCase(rawFullName);
            document.getElementById('lblDetalleTitle').textContent = `Detalle del Empleado: ${fullName}`;
            document.getElementById('lblFullName').textContent = fullName;
            
            // Estado badge en header card (Corregido Casing a Capitalizado: Activo / Baja)
            const isActive = emp.idCatStatus === 1 || emp.strCatStatus === "Activo" || emp.strCatStatus === "1";
            const statusEl = document.getElementById('lblStatus');
            if (isActive) {
                statusEl.innerHTML = '<span class="badge-status-activo">Activo</span>';
            } else {
                statusEl.innerHTML = '<span class="badge-status-baja">Baja</span>';
            }

            document.getElementById('btnEditEmpleado').onclick = () => {
                window.location.href = `/Empleado/Create?id=${emp.id}`;
            };

            // Fallback dinámico robusto para la foto del empleado
            const avatarContainer = document.getElementById('avatarContainer');
            const fileDocs = emp.empDocumentosLaborales;
            if (fileDocs && fileDocs.strUrlFotoEmp && fileDocs.strUrlFotoEmp !== 'N/D' && fileDocs.strUrlFotoEmp !== 'Foto Empleado') {
                const img = document.createElement('img');
                img.src = fileDocs.strUrlFotoEmp;
                img.alt = 'Foto Empleado';
                img.onerror = () => {
                    avatarContainer.innerHTML = `<img src="/svg/vista-empleados/avatar.svg" alt="Avatar predeterminado" style="opacity: 0.5; width: 48px; height: 48px;" />`;
                };
                avatarContainer.innerHTML = '';
                avatarContainer.appendChild(img);
            } else {
                avatarContainer.innerHTML = `<img src="/svg/vista-empleados/avatar.svg" alt="Avatar predeterminado" style="opacity: 0.5; width: 48px; height: 48px;" />`;
            }

            document.getElementById('valCurp').textContent = emp.strCurp || '—';
            document.getElementById('valRfc').textContent = emp.strRfc || '—';
            document.getElementById('valNss').textContent = emp.bigNss || emp.intNss || '—';
            document.getElementById('valEdad').textContent = emp.intEdad || '—';
            
            if (emp.dteFechaNacimiento) {
                document.getElementById('valFechaNacimiento').textContent = emp.dteFechaNacimiento.split('T')[0];
            }

            // Resolver género, estado civil y nacionalidad a través de búsqueda en catálogo de BD en formato Title Case
            const genOpt = generosRes.success && generosRes.data ? generosRes.data.find(x => x.id === emp.idEmpCatGenero) : null;
            document.getElementById('valGenero').textContent = genOpt ? toTitleCase(genOpt.strValor) : '—';

            const estOpt = estadosRes.success && estadosRes.data ? estadosRes.data.find(x => x.id === emp.idEmpCatEstadoCivil) : null;
            document.getElementById('valEstadoCivil').textContent = estOpt ? toTitleCase(estOpt.strValor) : '—';

            const nacOpt = nacsRes.success && nacsRes.data ? nacsRes.data.find(x => x.id === emp.idEmpCatNacionalidad) : null;
            document.getElementById('valNacionalidad').textContent = nacOpt ? toTitleCase(nacOpt.strValor) : '—';
            
            document.getElementById('valTelCelular').textContent = (emp.empTelefonos && emp.empTelefonos[0]) ? (emp.empTelefonos[0].bigNumeroCelular || emp.empTelefonos[0].strNumeroCelular || '—') : '—';
            document.getElementById('valTelFijo').textContent = (emp.empTelefonos && emp.empTelefonos[0]) ? (emp.empTelefonos[0].bigNumeroFijo || emp.empTelefonos[0].strNumeroFijo || '—') : '—';
            document.getElementById('valCorreo').textContent = emp.strCorreoElectronico || '—';

            if (emp.empDireccion) {
                document.getElementById('valNumExterior').textContent = emp.empDireccion.intNumExterior || '—';
                document.getElementById('valNumInterior').textContent = emp.empDireccion.intNumInterior || '—';
                
                const colId = emp.empDireccion.idEmpCatColonia;
                if (colId) {
                    fetch('/Empleado/GetColonia?id=' + colId)
                        .then(res => res.json())
                        .then(res => {
                            if (res.success && res.data) {
                                const estado = toTitleCase(res.data.strEstado || '');
                                const municipio = toTitleCase(res.data.strMunicipio || '');
                                const cp = String(res.data.intCodigoPostal).padStart(5, '0');
                                const colNombre = toTitleCase(res.data.strValor || '');
                                
                                document.getElementById('valColonia').textContent = colNombre || '—';
                                document.getElementById('valCodigoPostal').textContent = cp || '—';
                                document.getElementById('valEstado').textContent = estado || '—';
                                document.getElementById('valMunicipio').textContent = municipio || '—';
                            }
                        });
                }
            }

            if (emp.empDatosAcademicos) {
                document.getElementById('valNivelEstudios').textContent = toTitleCase(emp.empDatosAcademicos.strNivelEstudios) || '—';
                document.getElementById('valEstatusEstudios').textContent = toTitleCase(emp.empDatosAcademicos.strEstatus) || '—';
                document.getElementById('valCarrera').textContent = toTitleCase(emp.empDatosAcademicos.strCarrera) || '—';
                document.getElementById('valInstitucion').textContent = toTitleCase(emp.empDatosAcademicos.strInstitucion) || '—';
                if (emp.empDatosAcademicos.dteFechaInicio) document.getElementById('valFechaInicioEstudios').textContent = emp.empDatosAcademicos.dteFechaInicio.split('T')[0];
                if (emp.empDatosAcademicos.dteFechaFin) document.getElementById('valFechaFinEstudios').textContent = emp.empDatosAcademicos.dteFechaFin.split('T')[0];
            }

            if (emp.empCondicionesLaborales) {
                document.getElementById('valSueldoMensual').textContent = '$' + formatNumberWithComas(emp.empCondicionesLaborales.mnySueldoMensual.toFixed(2));
                if (emp.empCondicionesLaborales.dteFechaIngreso) document.getElementById('valFechaIngreso').textContent = emp.empCondicionesLaborales.dteFechaIngreso.split('T')[0];
                
                const setupBadge = (id, check) => {
                    const el = document.getElementById(id);
                    if (check) {
                        el.className = 'badge-si';
                        el.textContent = 'Sí';
                    } else {
                        el.className = 'badge-no';
                        el.textContent = 'No';
                    }
                };

                setupBadge('badgeVivienda', emp.empCondicionesLaborales.bitCercaniaVivienda);
                setupBadge('badgeViaje', emp.empCondicionesLaborales.bitDisponibilidadDeViaje);
                setupBadge('badgeExpArea', emp.empCondicionesLaborales.bitExperienciaEnArea);
                setupBadge('badgeCambioResidencia', emp.empCondicionesLaborales.bitDisponibilidadCambioResidencia);
            }

            // Mapear puesto y área correctos desde catálogo en Formato Title Case
            const lblPuesto = document.getElementById('lblPuesto');
            if (lblPuesto) {
                lblPuesto.textContent = toTitleCase(emp.strEmpCatTipoContratacion || 'Sin Tipo de Contratación');
            }
            
            const histAreaId = (emp.empHistorialAreas && emp.empHistorialAreas.length > 0) ? emp.empHistorialAreas[0].idEmpCatAreaLaboral : null;
            const areaOpt = histAreaId && areasRes.success && areasRes.data ? areasRes.data.find(x => x.id === histAreaId) : null;
            const areaNameText = areaOpt ? toTitleCase(areaOpt.strValor || areaOpt.strDescripcion) : toTitleCase(emp.strEmpCondicionesLaborales || 'Sin Condiciones Laborales');
            document.getElementById('lblArea').textContent = areaNameText;

            // Experiencias (Timeline minimalista)
            const expContainer = document.getElementById('experienciasPreviewContainer');
            const experiences = emp.empExperiencias || [];
            if (experiences.length === 0) {
                expContainer.innerHTML = '<div class="text-muted small text-center py-2">Sin experiencia laboral registrada</div>';
            } else {
                expContainer.innerHTML = '';
                const previewExp = experiences.slice(0, 2);
                previewExp.forEach(exp => {
                    expContainer.appendChild(createExperienceHtmlItem(exp));
                });

                if (experiences.length > 2) {
                    const btnShowExp = document.getElementById('btnShowMoreExp');
                    btnShowExp.style.display = 'inline-flex';
                    btnShowExp.onclick = () => {
                        const modalBody = document.getElementById('modalExperienciasBody');
                        modalBody.innerHTML = '';
                        experiences.forEach(exp => {
                            modalBody.appendChild(createExperienceHtmlItem(exp));
                        });
                        const modal = new bootstrap.Modal(document.getElementById('modalExperiencias'));
                        modal.show();
                    };
                }
            }

            // Referencias (Rediseño Estilo Contact Cards)
            const refContainer = document.getElementById('referenciasPreviewContainer');
            const references = emp.empReferenciasPersonales || [];
            if (references.length === 0) {
                refContainer.innerHTML = '<div class="text-muted small text-center py-2">Sin referencias personales registradas</div>';
            } else {
                refContainer.innerHTML = '';
                const previewRef = references.slice(0, 2);
                previewRef.forEach(ref => {
                    refContainer.appendChild(createReferenceHtmlItem(ref));
                });

                if (references.length > 2) {
                    const btnShowRef = document.getElementById('btnShowMoreRef');
                    btnShowRef.style.display = 'inline-flex';
                    btnShowRef.onclick = () => {
                        const modalBody = document.getElementById('modalReferenciasBody');
                        modalBody.innerHTML = '';
                        references.forEach(ref => {
                            modalBody.appendChild(createReferenceHtmlItem(ref));
                        });
                        const modal = new bootstrap.Modal(document.getElementById('modalReferencias'));
                        modal.show();
                    };
                }
            }

            // Poblar botones de documentos con visor modal
            if (emp.empDocumentosLaborales) {
                setupVerDocButton('btnVerIdentificacion', 'docNameIdentificacion', emp.empDocumentosLaborales.strUrlIdentificacionOficial, 'Identificación Oficial');
                setupVerDocButton('btnVerDomicilio', 'docNameDomicilio', emp.empDocumentosLaborales.strUrlComprobanteDomicilio, 'Comprobante de Domicilio');
                setupVerDocButton('btnVerCv', 'docNameCv', emp.empDocumentosLaborales.strUrlCurriculumVitae, 'Curriculum Vitae (CV)');
                setupVerDocButton('btnVerContrato', 'docNameContrato', emp.empDocumentosLaborales.strUrlContrato, 'Contrato Laboral');
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: empRes.message || 'No se pudieron cargar los datos del empleado.',
                confirmButtonColor: 'var(--teal-cavex)'
            });
        }
    })
    .catch(err => {
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error de servidor',
            text: 'No se pudo conectar al servidor o cargar los catálogos.',
            confirmButtonColor: 'var(--teal-cavex)'
        });
    });
});

function createExperienceHtmlItem(exp) {
    const container = document.createElement('div');
    container.className = 'timeline-item';
    
    const feInicio = exp.dteFechaIncio ? exp.dteFechaIncio.split('T')[0] : '—';
    const feFin = exp.dteFechaFin ? exp.dteFechaFin.split('T')[0] : '—';
    
    container.innerHTML = `
        <div class="timeline-header">
            <span class="timeline-title"><strong>Puesto:</strong> ${toTitleCase(exp.strPuesto)}</span>
            <span class="timeline-salary"><strong>Sueldo:</strong> $${formatNumberWithComas(exp.mnySueldo.toFixed(2))}</span>
        </div>
        <div class="timeline-company"><strong>Empresa:</strong> ${toTitleCase(exp.strEmpresa)}</div>
        <div class="timeline-meta">
            <div><strong>Área:</strong> ${toTitleCase(exp.strArea)}</div>
            <div><strong>Periodo:</strong> ${feInicio} al ${feFin}</div>
            <div class="mt-1"><strong>Motivo de salida:</strong> ${toTitleCase(exp.strMotivoSalida || '—')}</div>
        </div>
    `;
    return container;
}

function createReferenceHtmlItem(ref) {
    const card = document.createElement('div');
    card.className = 'reference-contact-card';
    
    const fullName = toTitleCase(ref.strNombreCompleto);
    const firstLetter = fullName && fullName !== '—' ? fullName.charAt(0).toUpperCase() : 'R';
    const relationship = toTitleCase(ref.strParentezco || ref.strParentesco || 'Referencia');
    const phone = ref.bigTelefono || ref.intTelefono || ref.intTelefonoCellular || ref.intTelefonoCelular || '—';
    
    card.innerHTML = `
        <div class="reference-avatar">${firstLetter}</div>
        <div class="reference-info">
            <div class="reference-name">${fullName}</div>
            <div class="reference-meta-row">
                <span class="reference-relationship">${relationship}</span>
                <span class="text-muted">•</span>
                <a href="tel:${phone}" class="reference-phone-link">
                    <img src="/svg/vista-empleados/phone.svg" alt="" />
                    ${phone}
                </a>
            </div>
        </div>
    `;
    return card;
}

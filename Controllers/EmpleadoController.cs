using Cavex.Principal.Models.EmpEmpleado;
using Cavex.Principal.Services.Interfaces;
using Cavex.Principal.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Hosting;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using System.Linq;
using System.IO;
using System;
using System.Net;

namespace Cavex.Principal.Controllers
{
    public class EmpleadoController : Controller
    {
        private readonly IEmpEmpleadoService _service;
        private readonly Cavex.Principal.ApiClients.EmpCatColonia.IEmpCatColoniaApi _coloniaApi;
        private readonly Cavex.Principal.ApiClients.ICavexGeneralCatalogApi _catalogApi;
        private readonly ICatStatusService _statusService;
        private readonly IMemoryCache _cache;
        private readonly IWebHostEnvironment _webHostEnvironment;

        public EmpleadoController(
            IEmpEmpleadoService service,
            Cavex.Principal.ApiClients.EmpCatColonia.IEmpCatColoniaApi coloniaApi,
            Cavex.Principal.ApiClients.ICavexGeneralCatalogApi catalogApi,
            ICatStatusService statusService,
            IMemoryCache cache,
            IWebHostEnvironment webHostEnvironment)
        {
            _service = service;
            _coloniaApi = coloniaApi;
            _catalogApi = catalogApi;
            _statusService = statusService;
            _cache = cache;
            _webHostEnvironment = webHostEnvironment;
        }

        [HttpGet]
        public async Task<IActionResult> GetColonias(string? search, CancellationToken cancellationToken)
        {
            try
            {
                var pageSize = string.IsNullOrWhiteSpace(search) ? 15 : 100;
                var response = await _coloniaApi.GetAllAsync(1, pageSize, search, cancellationToken);
                if (response == null || !response.Success)
                {
                    return Json(new { success = false, message = response?.Message ?? "No se pudieron obtener las colonias." });
                }
                return Json(new { success = true, data = response.Data?.Items });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetColonia(int id, CancellationToken cancellationToken)
        {
            try
            {
                var response = await _coloniaApi.GetByIdAsync(id, cancellationToken);
                if (response == null || !response.Success)
                {
                    return Json(new { success = false, message = response?.Message ?? "No se pudo obtener la colonia." });
                }
                return Json(new { success = true, data = response.Data });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetGeneros(CancellationToken cancellationToken)
        {
            try
            {
                var response = await _catalogApi.GetGenerosAsync(1, 100, cancellationToken);
                if (response == null || !response.Success)
                {
                    return Json(new { success = false, message = response?.Message ?? "No se pudieron obtener los géneros." });
                }
                return Json(new { success = true, data = response.Data?.Items });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetEstadosCiviles(CancellationToken cancellationToken)
        {
            try
            {
                var response = await _catalogApi.GetEstadosCivilesAsync(1, 100, cancellationToken);
                if (response == null || !response.Success)
                {
                    return Json(new { success = false, message = response?.Message ?? "No se pudieron obtener los estados civiles." });
                }
                return Json(new { success = true, data = response.Data?.Items });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetNacionalidades(CancellationToken cancellationToken)
        {
            try
            {
                var response = await _catalogApi.GetNacionalidadesAsync(1, 100, cancellationToken);
                if (response == null || !response.Success)
                {
                    return Json(new { success = false, message = response?.Message ?? "No se pudieron obtener las nacionalidades." });
                }
                return Json(new { success = true, data = response.Data?.Items });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
        {
            var response = await _statusService.ObtenerTodosAsync(cancellationToken);
            if (!response.Success)
            {
                return Json(new { success = false, message = response.Message });
            }
            return Json(new { success = true, data = response.Data?.Items });
        }

        public IActionResult Index(int pagina = 1)
        {
            ViewBag.PaginaActual = pagina;
            return View();
        }

        [HttpGet]
        public IActionResult Details(int id)
        {
            ViewBag.EmpleadoId = id;
            return View();
        }

        /// <summary>
        /// Actúa como proxy de solo lectura entre la vista de detalle y el endpoint PDF de la API.
        /// </summary>
        /// <param name="id">Identificador real del empleado recibido desde la ruta de la vista.</param>
        /// <param name="cancellationToken">
        /// Señal que cancela la llamada a la API cuando el navegador cierra la pestaña.
        /// </param>
        /// <returns>
        /// El PDF en disposición inline para abrirlo en el visor del navegador, o un mensaje de texto
        /// seguro y amigable cuando el identificador, el empleado o la API no son válidos.
        /// </returns>
        [HttpGet]
        public async Task<IActionResult> Imprimir(int id, CancellationToken cancellationToken)
        {
            // Validar antes de consumir la API evita trabajo innecesario y protege la acción si
            // alguien construye manualmente una URL con un identificador no válido.
            if (id <= 0)
            {
                return CrearRespuestaPdfError(
                    HttpStatusCode.BadRequest,
                    "El identificador del empleado debe ser mayor que cero.");
            }

            // El servicio reutiliza el cliente Refit configurado con ApiSettings:BaseUrl. El
            // controlador no conoce ni expone la dirección física de la API.
            var response = await _service.ObtenerPdfAsync(id, cancellationToken);
            if (!response.Success || response.Data is null)
            {
                var message = response.StatusCode switch
                {
                    HttpStatusCode.BadRequest => "El identificador del empleado no es válido.",
                    HttpStatusCode.NotFound => "No se encontró el empleado solicitado.",
                    _ => "No fue posible generar el expediente PDF del empleado."
                };

                return CrearRespuestaPdfError(response.StatusCode, message);
            }

            // El nombre ya fue saneado por el servicio. Inline indica a Safari, Chrome y Edge que
            // deben abrir el visor PDF en lugar de forzar inmediatamente una descarga.
            var pdf = response.Data;
            Response.Headers.ContentDisposition = $"inline; filename=\"{pdf.FileName}\"";

            // El expediente contiene datos personales; impedir su almacenamiento en cachés
            // compartidas reduce la exposición accidental después de cerrar la pestaña.
            Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
            Response.Headers.Pragma = "no-cache";
            Response.Headers["X-Content-Type-Options"] = "nosniff";

            // File recibe los bytes en memoria y no escribe ningún archivo temporal o permanente.
            return File(pdf.Content, pdf.ContentType);
        }

        /// <summary>
        /// Construye una respuesta de texto segura para la pestaña nueva cuando no existe un PDF.
        /// </summary>
        /// <param name="statusCode">Código HTTP que describe el fallo funcional.</param>
        /// <param name="message">Mensaje apto para mostrarse al usuario final.</param>
        /// <returns>Contenido de texto plano sin detalles internos, rutas ni excepciones.</returns>
        private static ContentResult CrearRespuestaPdfError(HttpStatusCode statusCode, string message)
        {
            // Un estado desconocido o no inicializado no debe convertirse en una respuesta HTTP
            // inválida; en ese caso se utiliza 500 con el mismo mensaje seguro.
            var numericStatusCode = (int)statusCode;
            if (numericStatusCode is < 400 or > 599)
            {
                numericStatusCode = StatusCodes.Status500InternalServerError;
            }

            return new ContentResult
            {
                StatusCode = numericStatusCode,
                ContentType = "text/plain; charset=utf-8",
                Content = message
            };
        }

        [HttpGet]
        public IActionResult Create()
        {
            return View(new CreateViewModel());
        }

        [HttpGet]
        public async Task<IActionResult> GetEmpleados(int pagina, string? search, string? status, CancellationToken cancellationToken)
        {
            if (pagina < 1) pagina = 1;
            int? statusVal = null;
            if (status == "activos") statusVal = 1;
            else if (status == "inactivos" || status == "baja") statusVal = 2;

            var countsCacheKey = $"empleados_counts_{search}";
            if (!_cache.TryGetValue(countsCacheKey, out Dictionary<string, int>? statusCounts))
            {
                var allCountResponse = await _service.ObtenerTodosAsync(1, 1, search, null, cancellationToken);
                int totalAllCount = allCountResponse.Success ? (allCountResponse.Data?.TotalCount ?? 0) : 0;

                var activeCountResponse = await _service.ObtenerTodosAsync(1, 1, search, 1, cancellationToken);
                int activeCount = activeCountResponse.Success ? (activeCountResponse.Data?.TotalCount ?? 0) : 0;

                var inactiveCountResponse = await _service.ObtenerTodosAsync(1, 1, search, 2, cancellationToken);
                int inactiveCount = inactiveCountResponse.Success ? (inactiveCountResponse.Data?.TotalCount ?? 0) : 0;

                statusCounts = new Dictionary<string, int>
                {
                    { "total", totalAllCount },
                    { "active", activeCount },
                    { "inactive", inactiveCount }
                };

                _cache.Set(countsCacheKey, statusCounts, TimeSpan.FromSeconds(10));
            }

            int totalAllCountVal = statusCounts["total"];
            int activeCountVal = statusCounts["active"];
            int inactiveCountVal = statusCounts["inactive"];

            var response = await _service.ObtenerTodosAsync(pagina, 10, search, statusVal, cancellationToken);
            if (!response.Success)
            {
                return Json(new { success = false, message = response.Message });
            }
            return Json(new { 
                success = true, 
                data = response.Data?.Items, 
                totalCount = response.Data?.TotalCount ?? 0,
                pageIndex = pagina,
                pageSize = 10,
                totalAllCount = totalAllCountVal,
                activeCount = activeCountVal,
                inactiveCount = inactiveCountVal
            });
        }

        /// <summary>
        /// Obtiene el listado general de empleados con un límite ampliado (1000 registros) 
        /// para poblar selectores (dropdowns) en el frontend sin paginación restrictiva.
        /// </summary>
        /// <param name="cancellationToken">Token de cancelación de la operación.</param>
        /// <returns>Resultado JSON con el listado de empleados obtenidos.</returns>
        [HttpGet("/Empleado/GetEmpleadosDropdown")]
        public async Task<IActionResult> GetEmpleadosDropdown(CancellationToken cancellationToken)
        {
            var response = await _service.ObtenerTodosAsync(1, 1000, null, 1, cancellationToken);
            if (!response.Success)
            {
                return Json(new { success = false, message = response.Message });
            }
            return Json(new { success = true, data = response.Data?.Items });
        }

        [HttpGet]
        public async Task<IActionResult> GetEmpleado(int id, CancellationToken cancellationToken)
        {
            var response = await _service.ObtenerPorIdAsync(id, cancellationToken);
            if (!response.Success)
            {
                return Json(new { success = false, message = response.Message });
            }
            return Json(new { success = true, data = response.Data });
        }

        private string CleanFolderName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "General";
            return string.Concat(name.Split(Path.GetInvalidFileNameChars())).Replace(" ", "_").Trim();
        }

        private async Task<string> SaveFileAsync(IFormFile file, string folder, string filePrefix)
        {
            var uploadsFolder = Path.Combine(_webHostEnvironment.WebRootPath, folder);
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }
            var extension = Path.GetExtension(file.FileName);
            var uniqueFileName = $"{filePrefix}_{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);
            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }
            return $"/{folder}/{uniqueFileName}".Replace("//", "/");
        }

        [HttpPost]
        public async Task<IActionResult> SaveEmpleado(
            [FromForm] string employeeData, 
            IFormFile? Identificacion, 
            IFormFile? Comprobante, 
            IFormFile? Cv, 
            IFormFile? Contrato, 
            IFormFile? Licencia, 
            IFormFile? FotoEmpleado,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(employeeData))
                {
                    return Json(new { success = false, message = "No se recibieron los datos del empleado." });
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var model = JsonSerializer.Deserialize<EmpEmpleadoSaveDto>(employeeData, options);
                if (model == null)
                {
                    return Json(new { success = false, message = "Datos del empleado inválidos." });
                }

                if (model.DocumentosLaborales == null)
                {
                    model.DocumentosLaborales = new EmpDocumentosLaboralesSaveDto();
                }

                string curp = CleanFolderName(model.StrCurp);
                string docsFolder = $"uploads/empleados/{curp}/documentos";
                string photoFolder = $"uploads/empleados/{curp}/foto";

                // Guardar los archivos si se subieron nuevos
                if (Identificacion != null && Identificacion.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlIdentificacionOficial = await SaveFileAsync(Identificacion, docsFolder, "identificacion");
                }
                if (Comprobante != null && Comprobante.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlComprobanteDomicilio = await SaveFileAsync(Comprobante, docsFolder, "comprobante");
                }
                if (Cv != null && Cv.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlCurriculumVitae = await SaveFileAsync(Cv, docsFolder, "cv");
                }
                if (Contrato != null && Contrato.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlContrato = await SaveFileAsync(Contrato, docsFolder, "contrato");
                }
                if (Licencia != null && Licencia.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlLicencia = await SaveFileAsync(Licencia, docsFolder, "licencia");
                }
                if (FotoEmpleado != null && FotoEmpleado.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlFotoEmp = await SaveFileAsync(FotoEmpleado, photoFolder, "foto");
                }

                // Limpiar ModelState anterior y forzar validación del nuevo modelo
                ModelState.Clear();
                if (!TryValidateModel(model))
                {
                    var errors = ModelState.Values
                        .SelectMany(v => v.Errors)
                        .Select(e => e.ErrorMessage)
                        .ToList();
                    return Json(new { success = false, message = string.Join(" ", errors) });
                }

                var response = await _service.CrearAsync(model, cancellationToken);
                if (!response.Success)
                {
                    return Json(new { success = false, message = response.Message });
                }
                return Json(new { success = true, data = response.Data });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Error al procesar el guardado: " + ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateEmpleado(
            int id,
            [FromForm] string employeeData, 
            IFormFile? Identificacion, 
            IFormFile? Comprobante, 
            IFormFile? Cv, 
            IFormFile? Contrato, 
            IFormFile? Licencia, 
            IFormFile? FotoEmpleado,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(employeeData))
                {
                    return Json(new { success = false, message = "No se recibieron los datos del empleado." });
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var model = JsonSerializer.Deserialize<EmpEmpleadoSaveDto>(employeeData, options);
                if (model == null)
                {
                    return Json(new { success = false, message = "Datos del empleado inválidos." });
                }

                if (model.DocumentosLaborales == null)
                {
                    model.DocumentosLaborales = new EmpDocumentosLaboralesSaveDto();
                }

                string curp = CleanFolderName(model.StrCurp);
                string docsFolder = $"uploads/empleados/{curp}/documentos";
                string photoFolder = $"uploads/empleados/{curp}/foto";

                // Guardar los archivos si se subieron nuevos
                if (Identificacion != null && Identificacion.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlIdentificacionOficial = await SaveFileAsync(Identificacion, docsFolder, "identificacion");
                }
                if (Comprobante != null && Comprobante.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlComprobanteDomicilio = await SaveFileAsync(Comprobante, docsFolder, "comprobante");
                }
                if (Cv != null && Cv.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlCurriculumVitae = await SaveFileAsync(Cv, docsFolder, "cv");
                }
                if (Contrato != null && Contrato.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlContrato = await SaveFileAsync(Contrato, docsFolder, "contrato");
                }
                if (Licencia != null && Licencia.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlLicencia = await SaveFileAsync(Licencia, docsFolder, "licencia");
                }
                if (FotoEmpleado != null && FotoEmpleado.Length > 0)
                {
                    model.DocumentosLaborales.StrUrlFotoEmp = await SaveFileAsync(FotoEmpleado, photoFolder, "foto");
                }

                // Limpiar ModelState anterior y forzar validación del nuevo modelo
                ModelState.Clear();
                if (!TryValidateModel(model))
                {
                    var errors = ModelState.Values
                        .SelectMany(v => v.Errors)
                        .Select(e => e.ErrorMessage)
                        .ToList();
                    return Json(new { success = false, message = string.Join(" ", errors) });
                }

                var response = await _service.ActualizarAsync(id, model, cancellationToken);
                if (!response.Success)
                {
                    return Json(new { success = false, message = response.Message });
                }
                return Json(new { success = true, data = response.Data });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Error al procesar la actualización: " + ex.Message });
            }
        }


        [HttpPost]
        public async Task<IActionResult> DeleteEmpleado(int id, CancellationToken cancellationToken)
        {
            var response = await _service.EliminarAsync(id, cancellationToken);
            if (!response.Success)
            {
                return Json(new { success = false, message = response.Message });
            }
            return Json(new { success = true, data = response.Data });
        }

        [HttpPost]
        public async Task<IActionResult> DeactivateEmpleado(int id, CancellationToken cancellationToken)
        {
            var responseGet = await _service.ObtenerPorIdAsync(id, cancellationToken);
            if (!responseGet.Success || responseGet.Data == null)
            {
                return Json(new { success = false, message = responseGet.Message ?? "Empleado no encontrado." });
            }

            var emp = responseGet.Data;

            var saveModel = new EmpEmpleadoSaveDto
            {
                StrNombre = emp.StrNombre,
                StrApellidoPaterno = emp.StrApellidoPaterno,
                StrApellidoMaterno = emp.StrApellidoMaterno,
                DteFechaNacimiento = emp.DteFechaNacimiento,
                StrRfc = emp.StrRfc,
                StrCurp = emp.StrCurp,
                IntEdad = emp.IntEdad,
                StrCorreoElectronico = emp.StrCorreoElectronico,
                BigNss = emp.BigNss,
                IdEmpCatGenero = emp.IdEmpCatGenero,
                IdEmpCatEstadoCivil = emp.IdEmpCatEstadoCivil,
                IdEmpCatNacionalidad = emp.IdEmpCatNacionalidad,
                IdEmpCatTipoContratacion = emp.IdEmpCatTipoContratacion,
                IdCatStatus = emp.IdCatStatus == 1 ? 2 : 1,

                Direccion = new EmpDireccionSaveDto
                {
                    IdEmpCatColonia = emp.EmpDireccion?.IdEmpCatColonia ?? 1,
                    IntNumExterior = emp.EmpDireccion?.IntNumExterior,
                    IntNumInterior = emp.EmpDireccion?.IntNumInterior
                },

                DatosAcademicos = new EmpDatosAcademicosSaveDto
                {
                    StrNivelEstudios = string.IsNullOrEmpty(emp.EmpDatosAcademicos?.StrNivelEstudios) ? "N/D" : emp.EmpDatosAcademicos.StrNivelEstudios,
                    StrInstitucion = string.IsNullOrEmpty(emp.EmpDatosAcademicos?.StrInstitucion) ? "N/D" : emp.EmpDatosAcademicos.StrInstitucion,
                    StrCarrera = emp.EmpDatosAcademicos?.StrCarrera,
                    StrEstatus = string.IsNullOrEmpty(emp.EmpDatosAcademicos?.StrEstatus) ? "N/D" : emp.EmpDatosAcademicos.StrEstatus,
                    DteFechaInicio = emp.EmpDatosAcademicos?.DteFechaInicio ?? DateOnly.FromDateTime(DateTime.Today),
                    DteFechaFin = emp.EmpDatosAcademicos?.DteFechaFin ?? DateOnly.FromDateTime(DateTime.Today)
                },

                DocumentosLaborales = new EmpDocumentosLaboralesSaveDto
                {
                    StrUrlIdentificacionOficial = string.IsNullOrEmpty(emp.EmpDocumentosLaborales?.StrUrlIdentificacionOficial) ? "N/D" : emp.EmpDocumentosLaborales.StrUrlIdentificacionOficial,
                    StrUrlComprobanteDomicilio = string.IsNullOrEmpty(emp.EmpDocumentosLaborales?.StrUrlComprobanteDomicilio) ? "N/D" : emp.EmpDocumentosLaborales.StrUrlComprobanteDomicilio,
                    StrUrlCurriculumVitae = string.IsNullOrEmpty(emp.EmpDocumentosLaborales?.StrUrlCurriculumVitae) ? "N/D" : emp.EmpDocumentosLaborales.StrUrlCurriculumVitae,
                    StrUrlContrato = string.IsNullOrEmpty(emp.EmpDocumentosLaborales?.StrUrlContrato) ? "N/D" : emp.EmpDocumentosLaborales.StrUrlContrato,
                    StrUrlLicencia = string.IsNullOrEmpty(emp.EmpDocumentosLaborales?.StrUrlLicencia) ? "N/D" : emp.EmpDocumentosLaborales.StrUrlLicencia,
                    StrUrlFotoEmp = emp.EmpDocumentosLaborales?.StrUrlFotoEmp ?? string.Empty
                },

                CondicionesLaborales = new EmpCondicionesLaboralesSaveDto
                {
                    BitCercaniaVivienda = emp.EmpCondicionesLaborales?.BitCercaniaVivienda ?? false,
                    BitDisponibilidadDeViaje = emp.EmpCondicionesLaborales?.BitDisponibilidadDeViaje ?? false,
                    MnySueldoMensual = emp.EmpCondicionesLaborales?.MnySueldoMensual ?? 0m,
                    BitExperienciaEnArea = emp.EmpCondicionesLaborales?.BitExperienciaEnArea ?? false,
                    BitDisponibilidadCambioResidencia = emp.EmpCondicionesLaborales?.BitDisponibilidadCambioResidencia ?? false,
                    DteFechaIngreso = emp.EmpCondicionesLaborales?.DteFechaIngreso ?? DateOnly.FromDateTime(DateTime.Today)
                },

                Referencias = emp.EmpReferenciasPersonales?.Select(rf => new EmpReferenciaSaveDto
                {
                    StrNombreCompleto = rf.StrNombreCompleto,
                    StrParentezco = rf.StrParentezco,
                    BigTelefono = rf.BigTelefono
                }).ToList() ?? new List<EmpReferenciaSaveDto>(),

                ExperienciaLaboral = emp.EmpExperiencias?.Select(exp => new EmpExperienciaLaboralSaveDto
                {
                    StrEmpresa = exp.StrEmpresa,
                    StrPuesto = exp.StrPuesto,
                    StrArea = exp.StrArea,
                    DteFechaIncio = exp.DteFechaIncio,
                    DteFechaFin = exp.DteFechaFin,
                    MnySueldo = exp.MnySueldo,
                    StrMotivoSalida = exp.StrMotivoSalida
                }).ToList() ?? new List<EmpExperienciaLaboralSaveDto>(),

                IdEmpCatAreaLaboral = emp.EmpHistorialAreas?.OrderByDescending(x => x.Id).FirstOrDefault()?.IdEmpCatAreaLaboral ?? 1,

                Telefonos = emp.EmpTelefonos?.Select(t => new Cavex.Principal.Models.EmpTelefono.EmpTelefonoSaveDto
                {
                    BigNumeroFijo = t.BigNumeroFijo,
                    BigNumeroCelular = t.BigNumeroCelular,
                    IdEmpEmpleado = id
                }).ToList() ?? new List<Cavex.Principal.Models.EmpTelefono.EmpTelefonoSaveDto>()
            };

            var responseUpdate = await _service.ActualizarAsync(id, saveModel, cancellationToken);
            if (!responseUpdate.Success)
            {
                return Json(new { success = false, message = responseUpdate.Message ?? "No fue posible actualizar el estado del empleado." });
            }

            return Json(new { success = true, message = saveModel.IdCatStatus == 2 ? "Empleado dado de baja exitosamente." : "Empleado activado exitosamente." });
        }
    }
}

    

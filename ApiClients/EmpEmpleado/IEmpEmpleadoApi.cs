using Cavex.Principal.Common;
using Cavex.Principal.Models.EmpEmpleado;
using Refit;

namespace Cavex.Principal.ApiClients.EmpEmpleado
{
    public interface IEmpEmpleadoApi
    {
        [Get("/api/v1/EmpEmpleado")]
        Task<ResponseWrapper<PagedResponse<EmpEmpleadoDto>>> GetAllAsync(
            [Query] int? pageIndex = null,
            [Query] int? pageSize = null,
            [Query] string? search = null,
            [Query] int? status = null,
            CancellationToken cancellationToken = default);

        [Get("/api/v1/EmpEmpleado/{id}")]
        Task<ResponseWrapper<EmpEmpleadoDto>> GetByIdAsync(int id, CancellationToken cancellationToken);

        /// <summary>
        /// Solicita a la API el expediente PDF de un empleado como una respuesta HTTP sin
        /// deserializar su contenido mediante el convertidor JSON de Refit.
        /// </summary>
        /// <param name="id">Identificador del empleado cuyo expediente debe generarse.</param>
        /// <param name="cancellationToken">
        /// Señal que cancela la petición cuando el navegador abandona la operación.
        /// </param>
        /// <returns>
        /// Respuesta HTTP original; el servicio consumidor debe validar su estado, cabeceras,
        /// contenido binario y liberar la respuesta después de leerla.
        /// </returns>
        [Get("/api/v1/EmpEmpleado/{id}/pdf")]
        Task<HttpResponseMessage> GetPdfAsync(int id, CancellationToken cancellationToken);

        [Post("/api/v1/EmpEmpleado/completo")]
        Task<ResponseWrapper<EmpEmpleadoDto>> CreateAsync([Body] RequestWrapper<EmpEmpleadoSaveDto> request, CancellationToken cancellationToken);

        [Put("/api/v1/EmpEmpleado/{id}")]
        Task<ResponseWrapper<EmpEmpleadoDto>> UpdateAsync(int id, [Body] RequestWrapper<EmpEmpleadoSaveDto> request, CancellationToken cancellationToken);

        [Delete("/api/v1/EmpEmpleado/{id}")]
        Task<ResponseWrapper<bool>> DeleteAsync(int id, CancellationToken cancellationToken);
    }
}
